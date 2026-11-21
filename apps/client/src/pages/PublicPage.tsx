import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { PageFont, PublicPage as Published } from '@shared/types';
import { darkTheme, lightTheme } from '../components/Editor';
import { schema } from '../components/editorSchema';
import { Spinner } from '../components/ui';
import { useTheme } from '../lib/theme';
import { cn, coverStyle, pageTitle } from '../lib/utils';

/** A page published to the web: read-only, no account needed. */
export default function PublicPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<Published | 'missing' | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/public/${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { data: Published }) => live && setData(body.data))
      .catch(() => live && setData('missing'));
    return () => {
      live = false;
    };
  }, [token]);

  useEffect(() => {
    if (data && data !== 'missing') document.title = `${pageTitle(data.page)} · Folium`;
  }, [data]);

  if (data === null) {
    return (
      <div className="grid h-dvh place-items-center bg-surface">
        <Spinner />
      </div>
    );
  }
  if (data === 'missing') {
    return (
      <div className="grid h-dvh place-items-center bg-surface px-6 text-center">
        <div>
          <p className="text-[40px]">🔒</p>
          <h1 className="mt-3 text-[18px] font-semibold text-strong">This page isn’t published</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            The link may be old, or its owner turned publishing off.
          </p>
          <Link to="/" className="mt-5 inline-block text-[13px] font-medium text-accent">
            Go to Folium
          </Link>
        </div>
      </div>
    );
  }

  const { page, blocks } = data;
  return (
    <div className="min-h-dvh bg-surface">
      {page.coverImage && (
        <div
          className="grain h-[min(30vh,280px)] w-full"
          style={{ background: coverStyle(page.coverImage) }}
        />
      )}
      <main
        className={cn(
          'mx-auto w-full pb-24',
          page.fullWidth ? 'max-w-none px-4 sm:px-14' : 'max-w-[808px] px-2',
        )}
      >
        <header className={cn('px-[54px]', page.coverImage ? 'pt-6' : 'pt-20')}>
          {page.icon && <p className="mb-3 text-[64px] leading-none">{page.icon}</p>}
          <h1
            className={cn(
              'text-[40px] font-bold leading-[1.2] tracking-tight text-strong',
              page.font === 'serif' && 'font-serif',
              page.font === 'mono' && 'font-mono text-[34px]',
            )}
          >
            {pageTitle(page)}
          </h1>
          <p className="mt-2 text-[12.5px] text-faint">
            Updated{' '}
            {new Date(page.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        </header>
        <ReadOnlyBlocks blocks={blocks} font={page.font} />
      </main>
      <footer className="pb-10 text-center text-[12px] text-faint">
        Published with{' '}
        <Link to="/" className="font-medium text-dim hover:text-strong">
          Folium
        </Link>
      </footer>
    </div>
  );
}

function ReadOnlyBlocks({ blocks, font }: { blocks: unknown[]; font: PageFont }) {
  const { isDark } = useTheme();
  const editor = useCreateBlockNote({
    schema,
    initialContent: blocks.length > 0 ? (blocks as never) : undefined,
  });
  return (
    <div className="folium-editor mt-4" data-font={font}>
      <BlockNoteView editor={editor} editable={false} theme={isDark ? darkTheme : lightTheme} />
    </div>
  );
}
