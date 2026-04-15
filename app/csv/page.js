'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BulkProductPage() {
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function handleFile(e) {
    setFile(e.target.files[0])
  }

  async function handleUpload() {
    if (!file) {
      setMessage('请先选择 CSV 文件')
      return
    }

    setLoading(true)
    setMessage('')

    const text = await file.text()
    const rows = text.split('\n').map((r) => r.split(','))

    // 假设第一行是 header
    const headers = rows[0]
    const dataRows = rows.slice(1)

    const products = dataRows
      .filter((row) => row.length > 1)
      .map((row) => {
        return {
          brand: row[0],
          series: row[1],
          flavor: row[2],
          name: row[3],
          sku: row[4],
          price: Number(row[5] || 0),
          stock: Number(row[6] || 0),
        }
      })

    const { error } = await supabase.from('products').insert(products)

    if (error) {
      setMessage('❌ 上传失败: ' + error.message)
    } else {
      setMessage('✅ 成功上传 ' + products.length + ' 个产品')
    }

    setLoading(false)
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>CSV 批量上传产品</h1>

      <div style={{ marginTop: 20 }}>
        <input type="file" accept=".csv" onChange={handleFile} />
      </div>

      <button
        onClick={handleUpload}
        style={{
          marginTop: 20,
          padding: '10px 20px',
          background: '#a47c57',
          color: '#fff',
          borderRadius: 10,
        }}
        disabled={loading}
      >
        {loading ? '上传中...' : '上传 CSV'}
      </button>

      {message && <div style={{ marginTop: 20 }}>{message}</div>}

      <div style={{ marginTop: 30 }}>
        <h3>CSV 格式：</h3>
        <pre>
brand,series,flavor,name,sku,price,stock  
SP,SP2,荔枝,SP2 荔枝,SP-SP2-LYCHEE,35,100  
SP,SP2,葡萄,SP2 葡萄,SP-SP2-GRAPE,35,80  
        </pre>
      </div>
    </main>
  )
}