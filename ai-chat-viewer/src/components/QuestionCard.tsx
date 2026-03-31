import React, { useEffect, useMemo, useState } from 'react';
import type { MessagePart } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { sendMessage } from '../utils/hwext';

interface QuestionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  onAnswered?: () => void;
  readOnly?: boolean;
}

function resolveInitialAnswer(part: MessagePart): string {
  return (part.answeredContent ?? '').trim();
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  welinkSessionId,
  onAnswered,
  readOnly = false,
}) => {
  const initialAnswer = useMemo(() => resolveInitialAnswer(part), [part]);
  const [customInput, setCustomInput] = useState(initialAnswer);
  const [answered, setAnswered] = useState(part.answered ?? false);
  const [selectedAnswer, setSelectedAnswer] = useState(initialAnswer);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const nextAnswer = resolveInitialAnswer(part);
    setCustomInput(nextAnswer);
    setAnswered(part.answered ?? false);
    setSelectedAnswer(nextAnswer);
  }, [part.answered, part.answeredContent, part.partId]);

  const isLocked = readOnly || answered || submitting;
  const trimmedInput = customInput.trim();

  const submitAnswer = async (value: string) => {
    const content = value.trim();
    if (!content || isLocked) return;

    setSubmitting(true);
    try {
      await sendMessage({
        welinkSessionId,
        content,
        toolCallId: part.toolCallId,
      });
      setAnswered(true);
      onAnswered?.();
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = (option: string) => {
    setSelectedAnswer(option);
    setCustomInput(option);
    void submitAnswer(option);
  };

  const handleSubmit = () => {
    const nextAnswer = customInput.trim();
    if (!nextAnswer) {
      return;
    }
    setSelectedAnswer(nextAnswer);
    void submitAnswer(nextAnswer);
  };

  const shouldHighlightOption = (option: string): boolean => {
    const normalizedSelectedAnswer = selectedAnswer.trim();
    return Boolean(normalizedSelectedAnswer) && normalizedSelectedAnswer === option;
  };

  return (
    <div className={`question-card ${answered ? 'question-card--answered' : ''}`}>
      {part.header && (
        <div className="question-card__header">{part.header}</div>
      )}
      <div className="question-card__question">
        <span className="question-card__icon">❓</span>
        {part.question ?? part.content}
      </div>

      {part.options && part.options.length > 0 && (
        <div className="question-card__options">
          {part.options.map((opt, i) => (
            <button
              key={i}
              className={`question-card__option ${shouldHighlightOption(opt) ? 'is-selected' : ''}`.trim()}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleSelect(opt);
                });
              }}
              disabled={isLocked}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="question-card__input-group">
        <input
          type="text"
          className="question-card__input"
          placeholder="输入自定义回答..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={isLocked}
        />
        <button
          className="question-card__submit"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              handleSubmit();
            });
          }}
          disabled={isLocked || !trimmedInput}
        >
          提交
        </button>
      </div>

      {answered && (
        <div className="question-card__status">✅ 已回答</div>
      )}
    </div>
  );
};
