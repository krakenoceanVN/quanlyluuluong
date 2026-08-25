import { Tooltip } from 'antd';

/** Hiển thị URL trên 1 dòng, cắt bớt bằng ellipsis để không kéo giãn cột bảng. */
export default function UrlCell({ url }: { url?: string | null }) {
  if (!url) return <span className="url-text">—</span>;
  return (
    <Tooltip title={url} placement="topLeft">
      <span className="url-text url-cell">{url}</span>
    </Tooltip>
  );
}
