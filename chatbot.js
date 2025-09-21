import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';
import NodeCache from 'node-cache';

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


export async function generate(userMessage, threadId) {
    const baseMessages = [
        {
            role: 'system',
content: `You are the smart AI-powered assistant of AntiSquat, a tool designed to detect phishing domains and protect users from online threats. 
          If anyone asks who you are, say you are AntiSquat's assistant. 
          If you know the answer to a question, answer it directly in plain English. 
          If the answer requires real-time, security checks, or updated threat information, or if you don’t know the answer, use the available tools to find it. 
          You have access to the following tool: 
          webSearch(query: string): Use this to search the internet for current or unknown information about domains, phishing threats, or cyber incidents. 
          Decide when to use your own knowledge and when to use the tool. 
          Do not mention the tool unless needed. 

          Examples:
          Q: What is phishing? 
          A: Phishing is a cyberattack where attackers trick people into revealing sensitive information, such as passwords or credit card numbers, often through fake websites or emails.

          Q: Is the domain "amaz0n-login.com" safe?
          A: That domain looks suspicious. It is likely a phishing attempt because of the misspelling of "amazon."

          Q: Tell me the latest phishing trends. 
          A: (use the search tool to get the latest phishing attack trends)

          Q: How can I protect myself from phishing? 
          A: Always check the domain name carefully, enable two-factor authentication, and avoid clicking on suspicious links.

          current date and time: ${new Date().toUTCString()}`
        }
        // {
        //     role: 'user',
        //     content: 'What is the current weather in Mumbai?',
        //     // When was iphone 16 launched?
        //     // What is the current weather in Mumbai?
        // },
    ];

    const messages = cache.get(threadId) ?? baseMessages;

    messages.push({
        role: 'user',
        content: userMessage,
    });

    const MAX_RETRIES = 10;
    let count = 0;

    while (true) {
        if (count > MAX_RETRIES) {
            return 'I Could not find the result, please try again';
        }
        count++;

        const completions = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            messages: messages,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'webSearch',
                        description:
                            'Search the latest information and realtime data on the internet.',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'The search query to perform search on.',
                                },
                            },
                            required: ['query'],
                        },
                    },
                },
            ],
            tool_choice: 'auto',
        });

        messages.push(completions.choices[0].message);

        const toolCalls = completions.choices[0].message.tool_calls;

        if (!toolCalls) {
            // here we end the chatbot response
            cache.set(threadId, messages);
            return completions.choices[0].message.content;
        }

        for (const tool of toolCalls) {
            // console.log('tool: ', tool);
            const functionName = tool.function.name;
            const functionParams = tool.function.arguments;

            if (functionName === 'webSearch') {
                const toolResult = await webSearch(JSON.parse(functionParams));
                // console.log('Tool result: ', toolResult);

                messages.push({
                    tool_call_id: tool.id,
                    role: 'tool',
                    name: functionName,
                    content: toolResult,
                });
            }
        }
    }
}
async function webSearch({ query }) {
    // Here we will do tavily api call
    console.log('Calling web search...');

    const response = await tvly.search(query);
    // console.log('Response: ', response);

    const finalResult = response.results.map((result) => result.content).join('\n\n');

    return finalResult;
}