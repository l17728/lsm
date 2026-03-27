import React, { useState, useEffect } from 'react';
import { Card, Tabs, Spin, Alert, Typography } from 'antd';
import { BookOutlined, ToolOutlined, ApiOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';

const { Title } = Typography;

interface Document {
  id: string;
  title: string;
  filename: string;
}

const DocsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docContents, setDocContents] = useState<Record<string, string>>({});
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState('user-manual');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/docs');
      setDocuments(response.data.documents);
      // Automatically load the first document
      if (response.data.documents?.length > 0) {
        fetchDocumentContent(response.data.documents[0].id);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentContent = async (docId: string) => {
    if (docContents[docId]) return; // Already loaded

    try {
      setLoadingDoc(docId);
      const response = await axios.get(`/api/docs/${docId}`);
      setDocContents(prev => ({
        ...prev,
        [docId]: response.data.content,
      }));
    } catch (err) {
      console.error(`Failed to fetch document ${docId}:`, err);
      setDocContents(prev => ({
        ...prev,
        [docId]: '# Load Failed\n\nUnable to load document content, please try again later.',
      }));
    } finally {
      setLoadingDoc(null);
    }
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'user-manual':
        return <BookOutlined />;
      case 'operations-manual':
        return <ToolOutlined />;
      case 'api-docs':
        return <ApiOutlined />;
      case 'release-notes':
        return <FileTextOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const handleTabChange = (key: string) => {
    setActiveKey(key);
    fetchDocumentContent(key);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="Loading documents..." />
      </div>
    );
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  const tabItems = documents.map(doc => ({
    key: doc.id,
    label: (
      <span>
        {getIcon(doc.id)} {doc.title}
      </span>
    ),
    children: (
      <div style={{ padding: '16px 0' }}>
        {loadingDoc === doc.id ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" tip="Loading..." />
          </div>
        ) : (
          <div className="markdown-body" style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '0 16px',
            lineHeight: '1.8',
          }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <Title level={1} style={{ marginTop: 0, marginBottom: 24 }}>{children}</Title>,
                h2: ({ children }) => <Title level={2} style={{ marginTop: 32, marginBottom: 16 }}>{children}</Title>,
                h3: ({ children }) => <Title level={3} style={{ marginTop: 24, marginBottom: 12 }}>{children}</Title>,
                h4: ({ children }) => <Title level={4} style={{ marginTop: 20, marginBottom: 8 }}>{children}</Title>,
                p: ({ children }) => <p style={{ marginBottom: 16 }}>{children}</p>,
                ul: ({ children }) => <ul style={{ marginBottom: 16, paddingLeft: 24 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ marginBottom: 16, paddingLeft: 24 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 8 }}>{children}</li>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <pre style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      overflow: 'auto',
                      marginBottom: 16,
                    }}>
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  ) : (
                    <code style={{
                      background: '#f6f8fa',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                    }} {...props}>{children}</code>
                  );
                },
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #e8e8e8',
                    }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{
                    border: '1px solid #e8e8e8',
                    padding: '8px 12px',
                    background: '#fafafa',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{
                    border: '1px solid #e8e8e8',
                    padding: '8px 12px',
                  }}>{children}</td>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: '4px solid #1890ff',
                    margin: '16px 0',
                    padding: '8px 16px',
                    background: '#f6f8fa',
                    color: '#666',
                  }}>{children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
                    {children}
                  </a>
                ),
              }}
            >
              {docContents[doc.id] || 'Click to load document content...'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    ),
  }));

  return (
    <Card bordered={false}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <BookOutlined style={{ marginRight: 8 }} />
        Documentation Center
      </Title>
      <Tabs
        activeKey={activeKey}
        items={tabItems}
        onChange={handleTabChange}
        size="large"
        tabBarStyle={{ marginBottom: 16 }}
      />
    </Card>
  );
};

export default DocsPage;