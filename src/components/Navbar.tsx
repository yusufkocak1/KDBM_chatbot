// src/components/Navbar.tsx
import React from 'react';
import './Navbar.css';

interface NavbarProps {
  isConnected: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isConnected }) => {
  return (
    <div className="navbar">
      <div className="navbar-brand">KDBM Veritabanı Asistanı</div>
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
             title={isConnected ? 'MCP Server Bağlantısı Aktif' : 'MCP Server Bağlantısı Yok'}>
        </div>
        <span>{isConnected ? 'Bağlı' : 'Bağlantı Yok'}</span>
      </div>
    </div>
  );
};

export default Navbar;
