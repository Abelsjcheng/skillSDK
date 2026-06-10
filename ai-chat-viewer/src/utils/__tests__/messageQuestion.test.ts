import { mapRawPartToMessagePart } from '../message';
import type { MessagePartSnapshot } from '../../types';

describe('question message parsing', () => {
  it('normalizes all input questions with options descriptions and per-question multiSelect flags', () => {
    const rawPart: MessagePartSnapshot = {
      partId: 'question-part-1',
      type: 'question',
      content: null,
      input: {
        questions: [
          {
            header: 'Question 1',
            question: 'Choose one platform',
            multiSelect: false,
            options: [
              { label: 'Android', description: 'Java/Kotlin SDK' },
              'iOS',
            ],
          },
          {
            header: 'Question 2',
            question: 'Choose secondary platforms',
            multiSelect: true,
            options: [
              { label: 'HarmonyOS', description: 'ArkTS SDK' },
              { label: 'Web' },
            ],
          },
        ],
      },
    };

    const part = mapRawPartToMessagePart(rawPart, false);

    expect(part.questions).toEqual([
      {
        header: 'Question 1',
        question: 'Choose one platform',
        multiSelect: false,
        options: [
          { label: 'Android', description: 'Java/Kotlin SDK' },
          { label: 'iOS' },
        ],
      },
      {
        header: 'Question 2',
        question: 'Choose secondary platforms',
        multiSelect: true,
        options: [
          { label: 'HarmonyOS', description: 'ArkTS SDK' },
          { label: 'Web' },
        ],
      },
    ]);
    expect(part.options).toEqual([
      { label: 'Android', description: 'Java/Kotlin SDK' },
      { label: 'iOS' },
    ]);
  });

  it('keeps the legacy top-level question shape as a single renderable question', () => {
    const rawPart: MessagePartSnapshot = {
      partId: 'question-part-1',
      type: 'question',
      content: null,
      header: 'Need confirmation',
      question: 'Which platform first?',
      multiSelect: false,
      options: ['Android', 'iOS'],
    };

    const part = mapRawPartToMessagePart(rawPart, false);

    expect(part.questions).toEqual([
      {
        header: 'Need confirmation',
        question: 'Which platform first?',
        multiSelect: false,
        options: [{ label: 'Android' }, { label: 'iOS' }],
      },
    ]);
  });
});
