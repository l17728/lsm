import React, { useState, useEffect } from 'react';
import { Input, Select, Button, Space, Tag, Dropdown, Menu, Modal, List } from 'antd';
import {
  SearchOutlined,
  HistoryOutlined,
  ClearOutlined,
  FilterOutlined,
  SaveOutlined,
} from '@ant-design/icons';

interface SearchHistoryItem {
  id: string;
  query: string;
  filters: Record<string, any>;
  timestamp: Date;
  label?: string;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: Record<string, any>) => void;
  onClear: () => void;
  placeholder?: string;
  filters?: {
    key: string;
    label: string;
    type: 'select' | 'input' | 'date' | 'number';
    options?: { value: string; label: string }[];
  }[];
  showHistory?: boolean;
  maxHistory?: number;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onClear,
  placeholder = '搜索...',
  filters = [],
  showHistory = true,
  maxHistory = 10,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    if (showHistory) {
      const saved = localStorage.getItem('searchHistory');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHistory(parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          })));
        } catch (e) {
          console.error('Failed to load search history:', e);
        }
      }
    }
  }, [showHistory]);

  // Save to history
  const saveToHistory = (searchQuery: string, searchFilters: Record<string, any>) => {
    if (!showHistory || !searchQuery.trim()) return;

    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: searchQuery,
      filters: searchFilters,
      timestamp: new Date(),
    };

    const updated = [newItem, ...history.filter(h => h.query !== searchQuery)].slice(0, maxHistory);
    setHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  };

  // Handle search
  const handleSearch = () => {
    onSearch(query, activeFilters);
    saveToHistory(query, activeFilters);
  };

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setActiveFilters({});
    onClear();
  };

  // Load from history
  const loadFromHistory = (item: SearchHistoryItem) => {
    setQuery(item.query);
    setActiveFilters(item.filters);
    setShowHistoryModal(false);
    onSearch(item.query, item.filters);
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
  };

  // Save current search as preset
  const saveAsPreset = () => {
    const label = prompt('请输入保存名称:');
    if (label) {
      const preset: SearchHistoryItem = {
        id: Date.now().toString(),
        query,
        filters: activeFilters,
        timestamp: new Date(),
        label,
      };

      const updated = [preset, ...history].slice(0, maxHistory);
      setHistory(updated);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
    }
  };

  // Filter dropdown menu
  const filterMenu = (
    <Menu style={{ padding: 16, minWidth: 300 }}>
      {filters.map((filter) => (
        <Menu.Item key={filter.key} style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{filter.label}</div>
          {filter.type === 'select' && (
            <Select
              style={{ width: '100%' }}
              placeholder={`选择${filter.label}`}
              value={activeFilters[filter.key]}
              onChange={(value) =>
                setActiveFilters({ ...activeFilters, [filter.key]: value })
              }
              allowClear
            >
              {filter.options?.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          )}
          {filter.type === 'input' && (
            <Input
              placeholder={`输入${filter.label}`}
              value={activeFilters[filter.key]}
              onChange={(e) =>
                setActiveFilters({ ...activeFilters, [filter.key]: e.target.value })
              }
              allowClear
            />
          )}
          {filter.type === 'date' && (
            <Input
              type="date"
              value={activeFilters[filter.key]}
              onChange={(e) =>
                setActiveFilters({ ...activeFilters, [filter.key]: e.target.value })
              }
            />
          )}
          {filter.type === 'number' && (
            <Input
              type="number"
              placeholder={`输入${filter.label}`}
              value={activeFilters[filter.key]}
              onChange={(e) =>
                setActiveFilters({ ...activeFilters, [filter.key]: e.target.value })
              }
            />
          )}
        </Menu.Item>
      ))}
      <Menu.Divider />
      <Menu.Item>
        <Button
          type="primary"
          block
          onClick={() => {
            handleSearch();
            setShowFilterDropdown(false);
          }}
        >
          搜索
        </Button>
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        prefix={<SearchOutlined />}
        style={{ flex: 1, minWidth: 200 }}
        allowClear
      />

      {filters.length > 0 && (
        <Dropdown
          overlay={filterMenu}
          trigger={['click']}
          open={showFilterDropdown}
          onOpenChange={setShowFilterDropdown}
        >
          <Button icon={<FilterOutlined />}>
            筛选
            {Object.keys(activeFilters).length > 0 && (
              <Tag color="blue" style={{ marginLeft: 4 }}>
                {Object.keys(activeFilters).length}
              </Tag>
            )}
          </Button>
        </Dropdown>
      )}

      <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
        搜索
      </Button>

      {(query || Object.keys(activeFilters).length > 0) && (
        <Button icon={<ClearOutlined />} onClick={handleClear}>
          清除
        </Button>
      )}

      {showHistory && history.length > 0 && (
        <>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setShowHistoryModal(true)}
          >
            历史
          </Button>

          <Modal
            title="搜索历史"
            open={showHistoryModal}
            onCancel={() => setShowHistoryModal(false)}
            footer={[
              <Button key="clear" danger icon={<ClearOutlined />} onClick={clearHistory}>
                清空历史
              </Button>,
              <Button key="close" onClick={() => setShowHistoryModal(false)}>
                关闭
              </Button>,
            ]}
            width={600}
          >
            <List
              dataSource={history}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="load"
                      type="link"
                      onClick={() => loadFromHistory(item)}
                    >
                      使用
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.query}</span>
                        {item.label && <Tag color="green">{item.label}</Tag>}
                      </Space>
                    }
                    description={
                      <Space>
                        {Object.entries(item.filters).map(([key, value]) => (
                          <Tag key={key} color="blue">
                            {key}: {String(value)}
                          </Tag>
                        ))}
                        <span style={{ color: '#999', fontSize: 12 }}>
                          {item.timestamp.toLocaleString('zh-CN')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Modal>
        </>
      )}

      <Button
        icon={<SaveOutlined />}
        onClick={saveAsPreset}
        title="保存为预设"
      >
        保存
      </Button>
    </div>
  );
};

export default AdvancedSearch;
