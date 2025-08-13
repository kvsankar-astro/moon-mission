/**
 * Simple Vite Server Test
 * 
 * Tests the Vite server manager functionality in isolation
 */

import { ViteServerManager } from './vite-server-manager.js';

async function testViteServer() {
  console.log('🧪 Testing Vite Server Manager...');
  
  const server = new ViteServerManager({ 
    port: 8002, // Use different port to avoid conflicts
    silent: false 
  });
  
  try {
    // Test server startup
    console.log('🚀 Starting Vite server...');
    const info = await server.start();
    console.log(`✅ Server started: ${info.url}`);
    
    // Test health check
    console.log('🏥 Testing server health...');
    const isHealthy = await server.isHealthy();
    console.log(`✅ Server health: ${isHealthy ? 'OK' : 'Failed'}`);
    
    // Test URL generation
    const testUrl = server.getUrl('chandrayaan3.html');
    console.log(`🔗 Generated URL: ${testUrl}`);
    
    // Test server info
    const serverInfo = server.getServerInfo();
    console.log(`📊 Server info:`, serverInfo);
    
    // Clean shutdown
    console.log('🛑 Stopping server...');
    await server.stop();
    console.log('✅ Server stopped successfully');
    
    console.log('\n🎉 All Vite server tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Vite server test failed:', error.message);
    
    // Ensure cleanup
    try {
      await server.stop();
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
    
    return false;
  }
}

// Run the test
testViteServer()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });