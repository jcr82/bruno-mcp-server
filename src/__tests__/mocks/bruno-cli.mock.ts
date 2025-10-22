/**
 * Mock Bruno CLI responses for testing
 */

export const mockBrunoResponses = {
  // Mock successful request execution
  successfulRequest: {
    summary: {
      totalRequests: 1,
      passedRequests: 1,
      failedRequests: 0,
      totalDuration: 123
    },
    results: [
      {
        name: 'Get Users',
        passed: true,
        request: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/users'
        },
        response: {
          status: 200,
          statusText: 'OK',
          responseTime: 123,
          headers: {
            'content-type': 'application/json'
          },
          body: [
            {
              id: 1,
              name: 'Leanne Graham',
              email: 'Sincere@april.biz'
            }
          ]
        },
        assertions: [
          {
            name: 'Status should be 200',
            passed: true
          }
        ]
      }
    ],
    stdout: '',
    stderr: '',
    exitCode: 0
  },

  // Mock failed request execution
  failedRequest: {
    stdout: JSON.stringify({
      summary: {
        totalRequests: 1,
        passedRequests: 0,
        failedRequests: 1,
        totalDuration: 50
      },
      results: [
        {
          name: 'Get Invalid Endpoint',
          passed: false,
          request: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/invalid'
          },
          response: {
            status: 404,
            statusText: 'Not Found',
            responseTime: 50
          },
          error: 'Request failed with status 404',
          assertions: []
        }
      ]
    }),
    stderr: '',
    exitCode: 1
  },

  // Mock collection execution
  successfulCollection: {
    summary: {
      totalRequests: 3,
      passedRequests: 3,
      failedRequests: 0,
      totalDuration: 456
    },
    results: [
      {
        name: 'Get Users',
        passed: true,
        request: { method: 'GET', url: 'https://api.example.com/users' },
        response: { status: 200, responseTime: 150 }
      },
      {
        name: 'Get User by ID',
        passed: true,
        request: { method: 'GET', url: 'https://api.example.com/users/1' },
        response: { status: 200, responseTime: 156 }
      },
      {
        name: 'Create User',
        passed: true,
        request: { method: 'POST', url: 'https://api.example.com/users' },
        response: { status: 201, responseTime: 150 }
      }
    ],
    stdout: '',
    stderr: '',
    exitCode: 0
  },

  // Mock request list
  requestList: [
    {
      name: 'Get Users',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users',
      folder: 'Users'
    },
    {
      name: 'Get User by ID',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users/1',
      folder: 'Users'
    },
    {
      name: 'Create User',
      method: 'POST',
      url: 'https://jsonplaceholder.typicode.com/users',
      folder: 'Users'
    }
  ],

  // Mock collection discovery
  discoveredCollections: [
    '/Users/test/projects/api-tests',
    '/Users/test/projects/integration-tests',
    '/Users/test/projects/e2e-tests'
  ],

  // Mock environments
  environments: [
    {
      name: 'dev',
      path: '/test/collection/environments/dev.bru',
      variables: {
        baseUrl: 'https://dev.api.example.com',
        apiKey: 'dev-key-123'
      }
    },
    {
      name: 'staging',
      path: '/test/collection/environments/staging.bru',
      variables: {
        baseUrl: 'https://staging.api.example.com',
        apiKey: 'staging-key-456'
      }
    },
    {
      name: 'production',
      path: '/test/collection/environments/production.bru',
      variables: {
        baseUrl: 'https://api.example.com',
        apiKey: 'prod-key-789'
      }
    }
  ],

  // Mock request details
  requestDetails: {
    name: 'Get Users',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/users',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: undefined,
    auth: 'none',
    tests: [
      'Status should be 200',
      'Response should be an array',
      'Each user should have an id'
    ],
    metadata: {
      type: 'http-request',
      seq: 1
    }
  },

  // Mock collection validation
  validCollection: {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      hasBrunoJson: true,
      totalRequests: 3,
      validRequests: 3,
      invalidRequests: 0,
      environments: 3
    }
  },

  invalidCollection: {
    valid: false,
    errors: [
      'bruno.json file not found',
      'Request file "invalid-request.bru" has syntax errors'
    ],
    warnings: [
      'Environment "dev" has hardcoded secrets'
    ],
    summary: {
      hasBrunoJson: false,
      totalRequests: 5,
      validRequests: 4,
      invalidRequests: 1,
      environments: 2
    }
  },

  // Mock Bruno CLI not available
  cliNotAvailable: {
    stdout: '',
    stderr: 'Command not found: bru',
    exitCode: 127
  },

  // Mock timeout
  timeout: {
    stdout: '',
    stderr: 'Error: Command timed out after 30000ms',
    exitCode: 1
  }
};

/**
 * Mock execa responses for Bruno CLI commands
 */
export function getMockExecaResponse(command: string, args: string[]) {
  const argString = args.join(' ');

  // Collection run
  if (argString.includes('run') && !argString.includes('--filename')) {
    return Promise.resolve(mockBrunoResponses.successfulCollection);
  }

  // Single request run
  if (argString.includes('run') && argString.includes('--filename')) {
    if (argString.includes('invalid')) {
      return Promise.resolve(mockBrunoResponses.failedRequest);
    }
    return Promise.resolve(mockBrunoResponses.successfulRequest);
  }

  // Default
  return Promise.resolve({
    stdout: '{}',
    stderr: '',
    exitCode: 0
  });
}
