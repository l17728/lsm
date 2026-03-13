import React, { useState } from 'react'
import { Button, Dropdown, message, Space } from 'antd'
import { ExportOutlined, DownloadOutlined } from '@ant-design/icons'

interface ExportButtonProps {
  endpoint: string
  filename: string
  formats?: Array<{ key: string; label: string; extension: string }>
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  endpoint,
  filename,
  formats = [
    { key: 'csv', label: 'CSV', extension: 'csv' },
    { key: 'excel', label: 'Excel', extension: 'xlsx' },
  ],
}) => {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: { key: string; label: string; extension: string }) => {
    if (exporting) return

    setExporting(true)
    const loadingMsg = message.loading(`Exporting ${format.label}...`, 0)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}${endpoint}/${format.key}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}-${new Date().toISOString().split('T')[0]}.${format.extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      message.success(`Exported successfully as ${format.label}`)
    } catch (error: any) {
      message.error(`Export failed: ${error.message}`)
    } finally {
      loadingMsg()
      setExporting(false)
    }
  }

  return (
    <Dropdown
      menu={{
        items: formats.map((format) => ({
          key: format.key,
          label: `Export as ${format.label}`,
          icon: <DownloadOutlined />,
          onClick: () => handleExport(format),
        })),
      }}
      disabled={exporting}
    >
      <Button icon={<ExportOutlined />} loading={exporting}>
        Export <span style={{ marginLeft: 4 }}>▼</span>
      </Button>
    </Dropdown>
  )
}

export default ExportButton
