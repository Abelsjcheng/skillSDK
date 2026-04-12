import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { MessagePart, QuestionAnswerSubmission } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';

interface QuestionCardProps {
  part: MessagePart;
  onAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  readonly?: boolean;
}

function getAnswerText(part: MessagePart): string {
  return typeof part.output === 'string' ? part.output.trim() : '';
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  onAnswered,
  readonly = false,
}) => {
  const { t } = useI18n();
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
    const answer = value.trim();
    if (!answer || isLocked || !onAnswered) {
      return;
    }

    setSubmitting(true);
    try {
      await onAnswered({
        answer,
        toolCallId: part.toolCallId,
      });
      setAnswered(true);
      setSelectedAnswer(answer);
      setCustomInput(answer);
    } catch (err) {
      console.error('Failed to submit answer:', err);
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

      {part.options && part.options.length > 0 && (
        <div className="question-card__options">
          {part.options.map((opt, index) => (
            <button
              key={`${opt.label}-${index}`}
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
            placeholder={t('question.customPlaceholder')}
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
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
            {t('common.submit')}
          </button>
        </div>
      )}

      {answered && selectedAnswer && (
        <div className="question-card__result">
          <span className="question-card__result-label">{t('question.answered')}</span>
          <div className="question-card__result-content">{selectedAnswer}</div>
        </div>
      )}
    </div>
  );
};
