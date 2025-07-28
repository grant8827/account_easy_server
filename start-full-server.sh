#!/bin/bash

echo "🔧 Account Easy - Server Restart Script"
echo "========================================"

# Function to kill processes on port 5001
kill_server() {
    echo "🛑 Stopping any existing server on port 5001..."
    lsof -ti:5001 | xargs kill -9 2>/dev/null || echo "   No existing server found"
}

# Function to check MongoDB
check_mongodb() {
    echo "🔍 Checking MongoDB status..."
    
    # Check if MongoDB is running
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
        return 0
    else
        echo "❌ MongoDB is not running"
        echo "💡 Starting MongoDB..."
        
        # Try to start MongoDB with brew
        if command -v brew >/dev/null 2>&1; then
            brew services start mongodb-community
            sleep 3
            if pgrep -x "mongod" > /dev/null; then
                echo "✅ MongoDB started successfully"
                return 0
            fi
        fi
        
        echo "⚠️  Please start MongoDB manually:"
        echo "   brew services start mongodb-community"
        echo "   or"
        echo "   mongod"
        return 1
    fi
}

# Main execution
echo ""
kill_server
echo ""

if check_mongodb; then
    echo ""
    echo "🚀 Starting Account Easy server..."
    echo "   API will be available at: http://localhost:5001"
    echo "   MongoDB database: account_easy"
    echo ""
    echo "📋 Available endpoints:"
    echo "   POST /api/auth/register - User registration"
    echo "   POST /api/auth/login - User login"
    echo "   GET /api/auth/me - Get current user"
    echo ""
    echo "🔐 To create super user:"
    echo "   npm run create-super-user"
    echo ""
    echo "⏹️  Press Ctrl+C to stop the server"
    echo ""
    
    # Start the server
    cd "$(dirname "$0")"
    node index.js
else
    echo ""
    echo "❌ Cannot start server without MongoDB"
    echo "   Please start MongoDB first, then run this script again"
    exit 1
fi
