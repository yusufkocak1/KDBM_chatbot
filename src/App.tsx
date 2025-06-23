import React, { useState, useEffect } from 'react';
import './App.css';
import ChatBot from './components/ChatBot';
import Navbar from './components/Navbar';
import { mcpService } from './services/McpService';

function App() {
  const [isConnected, setIsConnected] = useState(false);

  // MCP bağlantısını kurma girişimi
  useEffect(() => {
    const initializeMcp = async () => {
      try {
        await mcpService.connect();
        setIsConnected(true);
      } catch (error) {
        console.error("MCP bağlantı hatası:", error);
        setIsConnected(false);
      }
    };

    initializeMcp();
  }, []);

  return (
    <div className="App">
      <Navbar isConnected={isConnected} />
      <main>
        <ChatBot isConnected={isConnected} />
      </main>
    </div>
  );
}

export default App;
