import { createStudioBFFClient } from '@prisma/studio-core/data/bff';
import { createPostgresAdapter } from '@prisma/studio-core/data/postgres-core';
import { Studio, type StudioProps } from '@prisma/studio-core/ui';
import '@prisma/studio-core/ui/index.css';
import { createElement, useMemo, type ComponentType, type ReactElement } from 'react';

interface StudioAppProps {
  csrfToken: string;
}

export default function StudioApp({ csrfToken }: StudioAppProps): ReactElement {
  const adapter = useMemo(() => {
    const executor = createStudioBFFClient({
      url: '/api/admin/studio/query',
      customHeaders: {
        'X-Studio-CSRF': csrfToken,
      },
    });

    return createPostgresAdapter({ executor });
  }, [csrfToken]);

  const StudioComponent = Studio as unknown as ComponentType<StudioProps>;
  return createElement(StudioComponent, { adapter });
}
