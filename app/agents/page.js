agents.map((agent) => {
  const currentSlug = agent.slug || agent.agent_slug || ''
  const fullLink = `https://order-system-murex.vercel.app/order/${currentSlug}`

  return (
    <div
      key={agent.id}
      className="rounded-[22px] border border-[#e8d8c8] bg-white p-4 shadow-sm transition hover:border-[#c8a487]"
    >
      {/* 上方 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold text-[#5f3d2e]">
            {agent.name || agent.agent_name || '-'}
          </div>
          <div className="text-xs text-[#8b6a57]">
            Code: {agent.code || '-'}
          </div>
        </div>

        <span
          className={`text-xs px-2 py-1 rounded-full ${
            agent.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {agent.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* 链接 */}
      <div className="mt-3">
        <div className="text-xs text-[#8b6a57] mb-1">专属链接</div>
        <div className="text-xs break-all text-[#5f3d2e] bg-[#f8f1ea] p-2 rounded-xl">
          {fullLink}
        </div>
      </div>

      {/* 按钮 */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(fullLink)}
          className="flex-1 rounded-xl bg-[#6f4b3e] px-3 py-2 text-xs text-white hover:bg-[#5f3d2e]"
        >
          📋 复制链接
        </button>

        <a
          href={fullLink}
          target="_blank"
          className="flex-1 rounded-xl border border-[#d9c3ae] px-3 py-2 text-xs text-center text-[#5f3d2e]"
        >
          🔗 打开
        </a>
      </div>
    </div>
  )
})