import React, { useEffect, useState } from 'react';
import type { MessagePart } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { sendMessage } from '../utils/hwext';
import { showToast } from '../utils/toast';

interface QuestionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  onAnswered?: () => void;
  readonly?: boolean;
}

function getAnswerText(part: MessagePart): string {
  return typeof part.output === 'string' ? part.output.trim() : '';
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  welinkSessionId,
  onAnswered,
  readonly = false,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(getAnswerText(part));
  const [answered, setAnswered] = useState(Boolean(part.answered || getAnswerText(part)));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const nextAnswer = getAnswerText(part);
    setAnswered(Boolean(part.answered || nextAnswer));
    setSelectedAnswer(nextAnswer);
    if (nextAnswer) {
      setCustomInput(nextAnswer);
    } else if (!part.answered) {
      setCustomInput('');
    }
  }, [part.answered, part.output, part.partId]);

  const isLocked = answered || submitting || readonly;
  const trimmedInput = customInput.trim();
  const shouldShowInteractiveControls = !readonly || !answered;

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
      setSelectedAnswer(content);
      setCustomInput(content);
      onAnswered?.();
    } catch (err) {
      console.error('Failed to submit answer:', err);
      showToast('提交回答失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = (option: string) => {
    void submitAnswer(option);
  };

  const handleSubmit = () => {
    void submitAnswer(customInput);
  };

  return (
    <div className={`question-card ${answered ? 'question-card--answered' : ''}`}>
      {part.header && (
        <div className="question-card__header">{part.header}</div>
      )}
      <div className="question-card__question">
        <span className="question-card__icon">?</span>
        {part.question ?? part.content}
      </div>

      {answered && selectedAnswer && (
        <div className="question-card__result">
          <span className="question-card__result-label">已回答</span>
          <div className="question-card__result-content">{selectedAnswer}</div>
        </div>
      )}

      {part.options && part.options.length > 0 && (
        <div className="question-card__options">
          {part.options.map((opt, i) => (
            <button
              key={`${opt.label}-${i}`}
              className="question-card__option"
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleSelect(opt.label);
                });
              }}
              disabled={isLocked}
            >
              <span className="question-card__option-label">{opt.label}</span>
              {opt.description && (
                <span className="question-card__option-desc">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {shouldShowInteractiveControls && (
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
      )}

      {answered && !selectedAnswer && (
        <div className="question-card__status">已回答</div>
      )}
    </div>
  );
};
