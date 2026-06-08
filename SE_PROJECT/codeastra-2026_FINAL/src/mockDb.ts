import { MockDB } from './types';

export const MOCK_DB: MockDB = {
  teams: [],
  adminState: {
    registrations_open: true,
    round1_finalized: false,
    round2_finalized: false,
    round1_started: false,
    round1_results_visible: false,
    round2_started: false,
    round2_results_visible: false,
    round3_started: false,
    round3_results_visible: false,
    round1_questions: [
        {
            type: 'mcq',
            question: "What is the output of `console.log(typeof null)` in JavaScript?",
            options: ["'object'", "'null'", "'undefined'", "'string'"],
            correctOption: 0
        },
        {
            type: 'mcq',
            question: "Which of the following is NOT a JavaScript framework/library?",
            options: ["React", "Vue", "Angular", "Laravel"],
            correctOption: 3
        },
        {
            type: 'coding',
            question: "Write a function that takes two integers, `a` and `b`, and returns their sum.",
            testCases: [
                { input: "a=2, b=3", output: "5" },
                { input: "a=-1, b=1", output: "0" },
                { input: "a=100, b=200", output: "300" }
            ],
            boilerplate: {
                javascript: `/*
 * Complete the function below.
 * @param {number} a The first number.
 * @param {number} b The second number.
 * @returns {number} The sum of a and b.
 */
function sum(a, b) {
  // Write your code here
  
}`,
                python: `# Complete the function below.
def sum(a, b):
  # Write your code here
  `,
                java: `class Solution {
    /**
     * @param a The first number.
     * @param b The second number.
     * @return The sum of a and b.
     */
    public static int sum(int a, int b) {
        // Write your code here
        
    }
}`,
                cpp: `#include <iostream>

// Complete the function below.
int sum(int a, int b) {
    // Write your code here
    
}`,
                c: `// Complete the function below.
int sum(int a, b) {
    // Write your code here
    
}`
            }
        }
    ],
    round2_problem: "Develop a web application that uses a public API (e.g., GitHub, a weather API) to fetch and display data in a creative and user-friendly way. The project should be submitted as a GitHub repository link.",
    round3_qualifiers_count: 5
  },
};