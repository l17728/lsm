import React, { useState, useEffect } from 'react';
import { MenuOutlined, CloseOutlined } from '@ant-design/icons';

/**
 * Mobile Navigation Component
 */
interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  currentPage: string;
  menuItems: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
  }>;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentPage,
  menuItems,
}) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="mobile-nav-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
        />
      )}

      {/* Slide-out menu */}
      <div
        className={`mobile-nav-menu ${isOpen ? 'open' : 'closed'}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '280px',
          height: '100vh',
          background: 'white',
          zIndex: 1000,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #e8e8e8',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px' }}>LSM 系统</h2>
          <CloseOutlined
            onClick={onClose}
            style={{ fontSize: '20px', cursor: 'pointer' }}
          />
        </div>

        {/* Menu items */}
        <nav style={{ padding: '16px 0' }}>
          {menuItems.map((item) => (
            <div
              key={item.key}
              onClick={() => {
                onNavigate(item.key);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                background: currentPage === item.key ? '#e6f7ff' : 'transparent',
                borderLeft: currentPage === item.key ? '3px solid #1890ff' : '3px solid transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = currentPage === item.key ? '#e6f7ff' : '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = currentPage === item.key ? '#e6f7ff' : 'transparent';
              }}
            >
              <span style={{ marginRight: '12px', fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '16px' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px',
            borderTop: '1px solid #e8e8e8',
            textAlign: 'center',
            fontSize: '12px',
            color: '#999',
          }}
        >
          LSM System v3.0
        </div>
      </div>
    </>
  );
};

/**
 * Mobile Bottom Navigation
 */
interface BottomNavProps {
  activeKey: string;
  onNavigate: (key: string) => void;
  items: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
  }>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeKey, onNavigate, items }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTop: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        zIndex: 999,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          onClick={() => onNavigate(item.key)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '4px 12px',
            cursor: 'pointer',
            color: activeKey === item.key ? '#1890ff' : '#666',
          }}
        >
          <span style={{ fontSize: '20px', marginBottom: '4px' }}>{item.icon}</span>
          <span style={{ fontSize: '12px' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Mobile Header Component
 */
interface MobileHeaderProps {
  title: string;
  onMenuClick: () => void;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  onMenuClick,
  rightAction,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 100,
      }}
    >
      <MenuOutlined onClick={onMenuClick} style={{ fontSize: '20px', cursor: 'pointer' }} />
      <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h1>
      <div>{rightAction}</div>
    </header>
  );
};

/**
 * Pull to refresh component
 */
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    if (distance > 0 && distance < 150) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling) return;
    setPulling(false);
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '100vh' }}
    >
      {refreshing && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            background: '#f5f5f5',
          }}
        >
          <span className="ant-spin ant-spin-spinning">🔄</span>
          <span style={{ marginLeft: '8px' }}>刷新中...</span>
        </div>
      )}
      {children}
    </div>
  );
};
