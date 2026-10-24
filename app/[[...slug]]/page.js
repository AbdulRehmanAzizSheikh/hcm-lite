'use client';

import dynamic from 'next/dynamic';

const ClientApp = dynamic(() => import('@/client/App'), { ssr: false });

export default function Page() {
  return <ClientApp />;
}
