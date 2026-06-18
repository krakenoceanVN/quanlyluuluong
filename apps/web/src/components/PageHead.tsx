import { Typography } from 'antd';
import type { ReactNode } from 'react';

export default function PageHead({
  title,
  crumb,
  extra,
}: {
  title: ReactNode;
  crumb?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <div>
        <Typography.Title level={3} style={{ margin: 0, fontSize: 20 }}>
          {title}
        </Typography.Title>
        {crumb && (
          <div style={{ color: '#8a91a5', fontSize: 12, marginTop: 4 }}>{crumb}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{extra}</div>
    </div>
  );
}
