import { Text } from '@mantine/core';
import { useEffect } from 'react';
import { useStorageEngine } from '../storage/storageEngineHooks';

export function TrainingFailed() {
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    if (storageEngine) {
      storageEngine.rejectCurrentParticipant('Failed training')
        .catch(() => {
          console.error('Failed to reject participant who failed training');
        });
    }
  }, [storageEngine]);

  return (
    <Text>
      Danke für Ihre Teilnahme. Leider haben Sie die Trainingsfrage nicht korrekt beantworten können, deshalb sind Sie nicht berechtigt, an der Studie teilzunehmen. Sie können das Fenster nun schließen.
    </Text>
  );
}
