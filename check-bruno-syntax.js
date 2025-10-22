#!/usr/bin/env node

/**
 * Script to check Bruno CLI syntax and available commands
 */

import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(cmd, description) {
  log(`\n${description}`, colors.cyan);
  log(`Command: ${cmd}`, colors.yellow);
  try {
    const output = execSync(cmd, { encoding: 'utf-8' });
    console.log(output);
    return true;
  } catch (error) {
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
    return false;
  }
}

log('🔍 Bruno CLI Syntax Checker', colors.green);
log('=' .repeat(50), colors.green);

// Check version
runCommand('npx bru --version', '1. Bruno CLI Version:');

// Check help
runCommand('npx bru --help', '2. Bruno CLI Help:');

// Check run command help
runCommand('npx bru run --help', '3. Bruno Run Command Help:');

// Try different syntax variations
log('\n4. Testing different command syntaxes:', colors.cyan);

const testCommands = [
  {
    cmd: 'npx bru run ./test-collection',
    desc: 'Run collection (path only)'
  },
  {
    cmd: 'npx bru run ./test-collection --env ./test-collection/environments/dev.bru',
    desc: 'Run collection with environment'
  },
  {
    cmd: 'npx bru run "Get All Users" ./test-collection',
    desc: 'Run specific request (name then path)'
  },
  {
    cmd: 'npx bru run ./test-collection "Get All Users"',
    desc: 'Run specific request (path then name)'
  },
  {
    cmd: 'npx bru run --help',
    desc: 'Get detailed run command help'
  }
];

log('\n🧪 Testing commands with actual collection:', colors.green);
log('(Some may fail - that\'s expected, we\'re finding the right syntax)\n', colors.yellow);

testCommands.forEach(({ cmd, desc }) => {
  log(`\nTest: ${desc}`, colors.blue);
  log(`Command: ${cmd}`, colors.yellow);
  
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    log('✅ SUCCESS!', colors.green);
    if (output) {
      console.log(output.substring(0, 200)); // Show first 200 chars
      if (output.length > 200) console.log('...');
    }
  } catch (error) {
    log('❌ Failed', colors.yellow);
    if (error.message) {
      const msg = error.message.substring(0, 200);
      console.log(msg);
    }
  }
});

log('\n' + '='.repeat(50), colors.green);
log('📝 Summary: Check the successful commands above to understand the correct syntax', colors.cyan);
log('Update the bruno-cli.ts file accordingly with the working syntax', colors.cyan);