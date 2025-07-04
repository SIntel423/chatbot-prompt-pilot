import { Dispatch, memo, SetStateAction } from 'react';
import { CrossIcon } from './icons';
import { Button } from './ui/button';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { UIMessage } from 'ai';

type PureArtifactCloseButtonProps = {
  setFeedback: Dispatch<SetStateAction<Array<UIMessage>>>;
};

function PureArtifactCloseButton({ setFeedback }: PureArtifactCloseButtonProps) {
  const { setArtifact } = useArtifact();

  return (
    <Button
      data-testid="artifact-close-button"
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={() => {
        console.log('Closing artifact');
        setFeedback([])
        setArtifact((currentArtifact) =>
          currentArtifact.status === 'streaming'
            ? {
              ...currentArtifact,
              isVisible: false,
            }
            : { ...initialArtifactData, status: 'idle' },
        );
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
