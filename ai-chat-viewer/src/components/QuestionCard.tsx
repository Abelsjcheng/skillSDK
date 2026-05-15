import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import sendQuestionIcon from '../imgs/send_question_icon.svg';
import type { QuestionCardProps } from '../types/components';
import type { MessagePart } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { WeLog } from '../utils/logger';

function getAnswerText(part: MessagePart): string {
  return typeof part.output === 'string' ? part.output.trim() : '';
}

function matchesOptionLabel(part: MessagePart, answer: string): boolean {
  return Boolean(part.options?.some((option) => option.label === answer));
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  onAnswered,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(getAnswerText(part));
  const [answered, setAnswered] = useState(Boolean(part.answered || getAnswerText(part)));
  const [submitting, setSubmitting] = useState(false);
  const [customFocused, setCustomFocused] = useState(false);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 22;
    const maxHeight = 112;
    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    const nextAnswer = getAnswerText(part);
    setAnswered(Boolean(part.answered || nextAnswer));
    setSelectedAnswer(nextAnswer);
    if (nextAnswer && !matchesOptionLabel(part, nextAnswer)) {
      setCustomInput(nextAnswer);
      return;
    }
    setCustomInput('');
  }, [part]);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [customInput]);

  const isLocked = answered || submitting || readonly;
  const trimmedInput = customInput.trim();
  const isCustomAnswer = Boolean(selectedAnswer) && !matchesOptionLabel(part, selectedAnswer);

  const submitAnswer = async (value: string) => {
    const answer = value.trim();
    if (!answer || isLocked || !onAnswered) {
      return;
    }

    const previousSelectedAnswer = selectedAnswer;
    setSelectedAnswer(answer);
    setSubmitting(true);
    try {
      await onAnswered({
        answer,
        toolCallId: part.toolCallId,
        subagentSessionId: part.subagentSessionId,
      });
      setAnswered(true);
      setSelectedAnswer(answer);
      if (!matchesOptionLabel(part, answer)) {
        setCustomInput(answer);
      }
    } catch (err) {
      setSelectedAnswer(previousSelectedAnswer);
      WeLog(`QuestionCard submit answer failed | extra=${JSON.stringify({
        partId: part.partId,
        toolCallId: part.toolCallId,
      })} | error=${JSON.stringify(err)}`);
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

  const handleCustomCardClick = () => {
    if (isLocked) {
      return;
    }
    textareaRef.current?.focus();
  };

  const isCustomSelected = isCustomAnswer || (!answered && (customFocused || Boolean(trimmedInput)));

  return (
    <div className={`question-card ${answered ? 'question-card--answered' : ''}`}>
      {part.subagentName ? (
        <div className="question-card__source">来自 {part.subagentName}</div>
      ) : null}
      {part.header ? (
        <div className="question-card__header">{part.header}</div>
      ) : null}
      <div className="question-card__question">{part.question ?? part.content}</div>

      <div className="question-card__options">
        {part.options?.map((opt, index) => {
          const isSelected = selectedAnswer === opt.label;
          return (
            <button
              key={`${opt.label}-${index}`}
              type="button"
              className={`question-card__option ${isSelected ? 'is-selected' : ''}`}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleSelect(opt.label);
                });
              }}
              disabled={isLocked}
            >
              <div className="question-card__option-main">
                <span className="question-card__option-radio-wrap" aria-hidden="true">
                  <span className="question-card__option-radio" />
                </span>
                <span className="question-card__option-label">{opt.label}</span>
              </div>
              {opt.description ? (
                <div className="question-card__option-desc">{opt.description}</div>
              ) : null}
            </button>
          );
        })}

        <div
          className={[
            'question-card__option',
            'question-card__option--custom',
            isCustomSelected ? 'is-selected' : '',
          ].filter(Boolean).join(' ')}
          onClick={handleCustomCardClick}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !isLocked) {
              event.preventDefault();
              handleCustomCardClick();
            }
          }}
          role="button"
          tabIndex={isLocked ? -1 : 0}
        >
          <div className="question-card__option-main">
            <span className="question-card__option-radio-wrap" aria-hidden="true">
              <span className="question-card__option-radio" />
            </span>
            <span className="question-card__option-label">{t('question.customOptionLabel')}</span>
          </div>
          <div className="question-card__custom-body">
            <div
              className={[
                'question-card__custom-input-shell',
                !trimmedInput ? 'is-empty' : '',
              ].filter(Boolean).join(' ')}
            >
              <textarea
                ref={textareaRef}
                className="question-card__input"
                placeholder={t('question.customAnswerPlaceholder')}
                value={customInput}
                onChange={(event) => setCustomInput(event.target.value)}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
                disabled={isLocked}
                rows={1}
              />
              <button
                type="button"
                className={`question-card__submit ${!trimmedInput ? 'is-hidden' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  runButtonClickWithDebounce(event, () => {
                    handleSubmit();
                  });
                }}
                disabled={isLocked}
                aria-label={t('common.submit')}
              >
                <img src={sendQuestionIcon} alt="" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
