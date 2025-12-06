/**
 * index.ts
 * Main CLI entry point using commander framework.
 * Orchestrates cache checking, data fetching, and user commands (list/show).
 */

import chalk from 'chalk';
import { program } from 'commander';
import { fetchAndMergeData } from './api';
import {
  isCacheValid,
  readCache,
  writeCache,
  getCacheRemainingTime
} from './cache';
import { MergedPost } from './types';

// Global variable to store posts after loading (either from cache or API)
let cachedPosts: MergedPost[] = [];

/**
 * Initializes the application by loading data from cache or fetching from API
 * Why: This is called once at startup to ensure data is available for all CLI commands.
 * It implements the caching strategy: use cached data if valid, otherwise fetch and cache.
 */
async function initializeData(): Promise<void> {
  try {
    // Check if cache exists and is valid
    if (isCacheValid()) {
      console.log(chalk.blue('ℹ Using Cached Data'));
      const cacheResponse = await readCache();

      if (cacheResponse.success && cacheResponse.data) {
        cachedPosts = cacheResponse.data;
        const remainingTime = getCacheRemainingTime();
        console.log(
          chalk.gray(`Cache valid for ${remainingTime} more seconds\n`)
        );
        return;
      }
    }

    // Cache is invalid or doesn't exist, fetch fresh data
    console.log(chalk.yellow('⏳ Fetching fresh data from API...'));
    const apiResponse = await fetchAndMergeData();

    if (!apiResponse.success || !apiResponse.data) {
      console.error(chalk.red(`✗ Error: ${apiResponse.error || 'Unknown error'}`));
      process.exit(1);
    }

    cachedPosts = apiResponse.data || [];

    // Save to cache for future use
    const cacheResponse = await writeCache(cachedPosts);
    if (cacheResponse.success) {
      console.log(chalk.green('✓ Data fetched and cached successfully\n'));
    } else {
      console.warn(
        chalk.yellow(`⚠ Data fetched but failed to cache: ${cacheResponse.error}\n`)
      );
    }
  } catch (error) {
    console.error(
      chalk.red(`✗ Critical Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
    process.exit(1);
  }
}

/**
 * Lists all posts in a formatted table
 * Implements filtering if --filter flag is provided
 * Why: Provides a user-friendly view of all posts with optional search capability
 * 
 * @param filter Optional filter string to search in post titles (case-insensitive)
 */
function handleListCommand(filter?: string): void {
  if (cachedPosts.length === 0) {
    console.log(chalk.yellow('No posts available'));
    return;
  }

  // Filter posts if filter string is provided
  let displayPosts = cachedPosts;
  if (filter) {
    const lowerFilter = filter.toLowerCase();
    displayPosts = cachedPosts.filter(post =>
      post.title.toLowerCase().includes(lowerFilter)
    );

    if (displayPosts.length === 0) {
      console.log(
        chalk.yellow(`No posts found matching filter: "${filter}"`)
      );
      return;
    }

    console.log(
      chalk.cyan(`Found ${displayPosts.length} post(s) matching "${filter}"\n`)
    );
  }

  // Display table header
  console.log(
    chalk.bold.cyan('─'.repeat(120))
  );
  console.log(
    chalk.bold.cyan(
      `${'ID'.padEnd(6)} | ${'Title'.padEnd(80)} | ${'Author Name'.padEnd(30)}`
    )
  );
  console.log(
    chalk.bold.cyan('─'.repeat(120))
  );

  // Display each post row
  displayPosts.forEach(post => {
    // Truncate long titles to fit in table
    const truncatedTitle = post.title.length > 78
      ? post.title.substring(0, 75) + '...'
      : post.title;

    console.log(
      `${String(post.id).padEnd(6)} | ${truncatedTitle.padEnd(80)} | ${post.author_name.padEnd(30)}`
    );
  });

  console.log(
    chalk.bold.cyan('─'.repeat(120)) + '\n'
  );
}

/**
 * Shows detailed information about a specific post by ID
 * Why: Provides a detailed view of a single post with all relevant information
 * 
 * @param idString The post ID as a string (converted from CLI argument)
 */
function handleShowCommand(idString: string): void {
  const id = parseInt(idString, 10);

  if (isNaN(id)) {
    console.error(chalk.red('✗ Error: Post ID must be a valid number'));
    process.exit(1);
  }

  const post = cachedPosts.find(p => p.id === id);

  if (!post) {
    console.error(chalk.red(`✗ Error: Post with ID ${id} not found`));
    process.exit(1);
  }

  // Display detailed post information
  console.log(chalk.bold.cyan('\n' + '─'.repeat(80)));
  console.log(chalk.bold.yellow(`Post #${post!.id}`));
  console.log(chalk.bold.cyan('─'.repeat(80)) + '\n');

  console.log(chalk.bold('Title:'));
  console.log(chalk.white(`  ${post!.title}\n`));

  console.log(chalk.bold('Author:'));
  console.log(chalk.white(`  ${post!.author_name}\n`));

  console.log(chalk.bold('Body:'));
  console.log(chalk.white(`  ${post!.body}\n`));

  console.log(chalk.bold('Metadata:'));
  console.log(chalk.gray(`  User ID: ${post!.userId}`));
  console.log(chalk.gray(`  Post ID: ${post!.id}\n`));
  console.log(chalk.bold.cyan('─'.repeat(80)) + '\n');
}

/**
 * Sets up all CLI commands using commander
 * Why: Commander provides a robust framework for parsing CLI arguments and flags
 * with automatic help generation and validation
 */
async function setupCliCommands(): Promise<void> {
  program
    .name('api-integration-cli')
    .description(
      'CLI tool to fetch, merge, and display data from JSONPlaceholder API with caching'
    )
    .version('1.0.0');

  // List command: displays all posts with optional filtering
  program
    .command('list')
    .description('List all posts with optional filtering')
    .option(
      '--filter <string>',
      'Filter posts by title (case-insensitive)'
    )
    .action((options: { filter?: string }) => {
      handleListCommand(options.filter);
    });

  // Show command: displays detailed information about a specific post
  program
    .command('show <id>')
    .description('Show detailed information about a specific post by ID')
    .action((id: string) => {
      handleShowCommand(id);
    });

  // Parse command-line arguments
  // Why: commander handles all the parsing, validation, and help generation
  program.parse(process.argv);

  // Show help if no command was provided
  if (program.args.length === 0) {
    program.outputHelp();
  }
}

/**
 * Main entry point for the CLI application
 * Orchestrates initialization and command setup
 */
async function main(): Promise<void> {
  try {
    // Step 1: Initialize data (load from cache or fetch from API)
    await initializeData();

    // Step 2: Setup and execute CLI commands
    await setupCliCommands();
  } catch (error) {
    console.error(
      chalk.red(
        `✗ Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

// Execute main function
main().catch(error => {
  console.error(chalk.red(`✗ Fatal Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  process.exit(1);
});
