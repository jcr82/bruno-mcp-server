# Getting Started Example Collection

This is a simple Bruno collection designed to help you get started with the Bruno MCP Server. It contains basic API requests that you can run immediately without any setup.

## What's Inside

This collection demonstrates common API testing scenarios using the free [JSONPlaceholder API](https://jsonplaceholder.typicode.com):

- **Get All Posts** - Retrieve a list of all posts
- **Get Single Post** - Retrieve a specific post by ID
- **Create Post** - Create a new post
- **Update Post** - Update an existing post

## Collection Structure

```
getting-started/
├── bruno.json              # Collection configuration
├── README.md              # This file
├── environments/
│   ├── dev.bru           # Development environment (JSONPlaceholder)
│   └── production.bru    # Production environment template
└── API Tests/
    ├── 1-Get All Posts.bru
    ├── 2-Get Single Post.bru
    ├── 3-Create Post.bru
    └── 4-Update Post.bru
```

## How to Use This Collection

### 1. Using Bruno MCP Server with Claude

Once you have the Bruno MCP Server configured in your MCP client (like Claude), you can run these examples:

#### Run a Single Request

```
Can you run the "Get All Posts" request from the getting-started collection?
```

Or using the tool directly:
```typescript
bruno_run_request({
  collectionPath: "/path/to/bruno-mcp-server/collection-examples/getting-started",
  requestName: "Get All Posts",
  environment: "dev"
})
```

#### Run the Entire Collection

```
Can you run all requests in the getting-started collection?
```

Or using the tool directly:
```typescript
bruno_run_collection({
  collectionPath: "/path/to/bruno-mcp-server/collection-examples/getting-started",
  environment: "dev"
})
```

#### List All Requests

```
Can you show me all the requests in the getting-started collection?
```

Or using the tool directly:
```typescript
bruno_list_requests({
  collectionPath: "/path/to/bruno-mcp-server/collection-examples/getting-started"
})
```

#### Validate Before Running (Dry Run)

```
Can you validate the Create Post request without actually sending it?
```

Or using the tool directly:
```typescript
bruno_run_request({
  collectionPath: "/path/to/bruno-mcp-server/collection-examples/getting-started",
  requestName: "Create Post",
  dryRun: true
})
```

#### Generate Reports

```
Can you run the collection and generate HTML and JSON reports?
```

Or using the tool directly:
```typescript
bruno_run_collection({
  collectionPath: "/path/to/bruno-mcp-server/collection-examples/getting-started",
  environment: "dev",
  reporterJson: "./reports/getting-started.json",
  reporterHtml: "./reports/getting-started.html"
})
```

### 2. Using Bruno CLI Directly

You can also run these requests using Bruno CLI:

```bash
# Run a single request
bru run "API Tests/1-Get All Posts.bru" --env dev

# Run the entire collection
bru run --env dev

# Run with report generation
bru run --env dev --reporter-json ./reports/results.json
```

### 3. Using Bruno Desktop App

1. Open Bruno Desktop
2. Click "Open Collection"
3. Navigate to `collection-examples/getting-started`
4. Select the `dev` environment
5. Click on any request and hit "Send"

## Environments

### Development (dev.bru)
- **baseUrl**: `https://jsonplaceholder.typicode.com`
- **environment**: `development`
- **timeout**: `5000`

This environment is ready to use immediately. JSONPlaceholder is a free fake REST API for testing and prototyping.

### Production (production.bru)
- **baseUrl**: `https://api.example.com` (template)
- **environment**: `production`
- **timeout**: `10000`

This is a template for your production environment. Replace the `baseUrl` with your actual API endpoint.

## What You'll Learn

By running these requests, you'll see:

1. ✅ **HTTP Methods** - GET, POST, PUT requests
2. ✅ **Environment Variables** - Using `{{baseUrl}}` from environments
3. ✅ **Request Headers** - Setting Accept and Content-Type headers
4. ✅ **Request Bodies** - Sending JSON payloads
5. ✅ **Tests/Assertions** - Validating response status, content-type, and data
6. ✅ **Test Reports** - Generating JSON, HTML, and JUnit reports

## Expected Results

All requests should pass when using the `dev` environment:

- **Get All Posts**: Returns 100 posts with status 200
- **Get Single Post**: Returns post #1 with status 200
- **Create Post**: Returns status 201 with new post ID
- **Update Post**: Returns status 200 with updated post data

Note: JSONPlaceholder is a fake API, so POST/PUT requests don't actually modify data on the server. They simulate the expected responses for testing purposes.

## Next Steps

After trying this collection:

1. **Modify the requests** - Change the post IDs, update the request bodies
2. **Add new requests** - Create DELETE requests, add query parameters
3. **Create your own collection** - Use this as a template for your API tests
4. **Integrate with CI/CD** - Use the report generation for automated testing
5. **Explore advanced features** - Try folder-specific runs, custom environments, parallel testing

## Troubleshooting

**Issue**: Collection not found
- **Solution**: Make sure you're using the full absolute path to the collection folder

**Issue**: Environment not found
- **Solution**: Check that the environment file exists in the `environments/` folder

**Issue**: Tests failing
- **Solution**: Verify you have internet access to reach jsonplaceholder.typicode.com

**Issue**: Bruno CLI not found
- **Solution**: Ensure you've run `npm install` in the bruno-mcp-server directory

## Learn More

- [Bruno MCP Server Documentation](../../README.md)
- [Bruno Documentation](https://docs.usebruno.com/)
- [JSONPlaceholder API](https://jsonplaceholder.typicode.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Feedback

Found an issue or have a suggestion? Please open an issue on [GitHub](https://github.com/jcr82/bruno-mcp-server/issues).

Happy testing! 🚀
