import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from '../QuestionCard';
import type { MessagePart } from '../../types';

function createQuestionPart(overrides: Partial<MessagePart> = {}): MessagePart {
  return {
    partId: 'question-part-1',
    type: 'question',
    content: 'Which platform should this requirement prioritize first?',
    isStreaming: false,
    questionId: 'question-1',
    toolCallId: 'tool-call-1',
    header: 'Need your confirmation',
    question: 'Which platform should this requirement prioritize first?',
    options: [
      { label: 'Android', description: 'Focus on Java/Kotlin SDK changes' },
      { label: 'iOS', description: 'Focus on Objective-C/Swift SDK changes' },
    ],
    ...overrides,
  };
}

describe('QuestionCard', () => {
  it('submits a single-choice single question immediately as a two-dimensional answer array', async () => {
    const user = userEvent.setup();
    const onAnswered = jest.fn().mockResolvedValue(undefined);

    render(
      <QuestionCard
        part={createQuestionPart()}
        messageId="message-1"
        onAnswered={onAnswered}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Android/ }));

    await waitFor(() => {
      expect(onAnswered).toHaveBeenCalledWith(expect.objectContaining({
        answer: [['Android']],
        messageId: 'message-1',
        toolCallId: 'tool-call-1',
        questionId: 'question-1',
      }));
    });
  });

  it('collects multiple selected options and custom input for a multi-select question before submit', async () => {
    const user = userEvent.setup();
    const onAnswered = jest.fn().mockResolvedValue(undefined);

    render(
      <QuestionCard
        part={createQuestionPart({
          questions: [{
            header: 'Question 1',
            question: 'Choose all target platforms',
            multiSelect: true,
            options: [
              { label: 'Android' },
              { label: 'iOS' },
              { label: 'HarmonyOS' },
            ],
          }],
        })}
        messageId="message-1"
        onAnswered={onAnswered}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Android/ }));
    await user.click(screen.getByRole('button', { name: /iOS/ }));
    await user.type(screen.getByPlaceholderText('请输出自定义答案'), '其他');

    expect(onAnswered).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(onAnswered).toHaveBeenCalledWith(expect.objectContaining({
        answer: [['Android', 'iOS', '其他']],
      }));
    });
  });

  it('preserves answers while navigating multiple questions and submits empty arrays for unanswered questions', async () => {
    const user = userEvent.setup();
    const onAnswered = jest.fn().mockResolvedValue(undefined);

    render(
      <QuestionCard
        part={createQuestionPart({
          questions: [
            {
              header: 'Question 1',
              question: 'Choose the first platform',
              multiSelect: false,
              options: [{ label: 'Android' }, { label: 'iOS' }],
            },
            {
              header: 'Question 2',
              question: 'Choose secondary platforms',
              multiSelect: true,
              options: [{ label: 'HarmonyOS' }, { label: 'Web' }],
            },
            {
              header: 'Question 3',
              question: 'Optional note',
              multiSelect: false,
              options: [{ label: 'Skip' }],
            },
          ],
        })}
        messageId="message-1"
        onAnswered={onAnswered}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Android/ }));
    await user.click(screen.getByRole('button', { name: '下一题' }));
    await user.click(screen.getByRole('button', { name: /HarmonyOS/ }));
    await user.click(screen.getByRole('button', { name: /Web/ }));
    await user.click(screen.getByRole('button', { name: '上一题' }));

    expect(screen.getByRole('button', { name: /Android/ })).toHaveClass('is-selected');

    await user.click(screen.getByRole('button', { name: '下一题' }));
    await user.click(screen.getByRole('button', { name: '下一题' }));
    await user.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(onAnswered).toHaveBeenCalledWith(expect.objectContaining({
        answer: [['Android'], ['HarmonyOS', 'Web'], []],
      }));
    });
  });

  it('shows a question and answer summary after submission succeeds', async () => {
    const user = userEvent.setup();
    const onAnswered = jest.fn().mockResolvedValue(undefined);

    render(
      <QuestionCard
        part={createQuestionPart({
          questions: [{
            header: 'Question 1',
            question: 'Choose all target platforms',
            multiSelect: true,
            options: [{ label: 'Android' }, { label: 'iOS' }],
          }],
        })}
        messageId="message-1"
        onAnswered={onAnswered}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Android/ }));
    await user.click(screen.getByRole('button', { name: /iOS/ }));
    await user.click(screen.getByRole('button', { name: '提交' }));

    expect(await screen.findByText('已回答')).toBeInTheDocument();
    expect(screen.getAllByText('Choose all target platforms')).toHaveLength(2);
    expect(screen.getByText('Android、iOS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Android/ })).toBeDisabled();
  });
});
