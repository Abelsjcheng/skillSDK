import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import sendQuestionIcon from '../imgs/send_question_icon.svg';
import type { QuestionCardProps } from '../types/components';
import type { MessagePart, QuestionAnswerMatrix, QuestionItem } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { WeLog } from '../utils/logger';
import {
  alignQuestionAnswerMatrix,
  formatQuestionAnswerDisplay,
  normalizeQuestionItems,
  parseQuestionAnswerMatrix,
} from '../utils/message';

interface QuestionDraftState {
  answerMatrix: QuestionAnswerMatrix;
  selectedAnswers: QuestionAnswerMatrix;
  customInputs: string[];
}

function getLegacyAnswerText(part: MessagePart): string {
  return typeof part.output === 'string' ? part.output.trim() : '';
}

function buildFallbackQuestion(part: MessagePart): QuestionItem {
  return {
    ...(part.header ? { header: part.header } : {}),
    question: part.question ?? part.content ?? '',
    options: part.options ?? [],
    multiSelect: Boolean(part.multiSelect),
  };
}

function buildQuestionItems(part: MessagePart): QuestionItem[] {
  return normalizeQuestionItems({
    input: part.input,
    header: part.header,
    question: part.question,
    options: part.options,
    multiSelect: part.multiSelect,
    questions: part.questions,
    content: part.content,
  }) ?? [buildFallbackQuestion(part)];
}

function getOptionLabelSet(question: QuestionItem): Set<string> {
  return new Set(question.options.map((option) => option.label));
}

function normalizeMatrixLength(questions: QuestionItem[], answerMatrix: QuestionAnswerMatrix): QuestionAnswerMatrix {
  return questions.map((_, index) => answerMatrix[index] ?? []);
}

function getInitialAnswerMatrix(part: MessagePart, questions: QuestionItem[]): QuestionAnswerMatrix {
  const parsedMatrix = parseQuestionAnswerMatrix(part.output);
  if (parsedMatrix) {
    return alignQuestionAnswerMatrix(questions, parsedMatrix);
  }

  const legacyAnswer = getLegacyAnswerText(part);
  if (legacyAnswer) {
    return normalizeMatrixLength(questions, [[legacyAnswer]]);
  }

  return questions.map(() => []);
}

function splitAnswerMatrix(questions: QuestionItem[], answerMatrix: QuestionAnswerMatrix): QuestionDraftState {
  const normalizedMatrix = normalizeMatrixLength(questions, answerMatrix);
  const selectedAnswers = normalizedMatrix.map((answers, index) => {
    const optionLabels = getOptionLabelSet(questions[index]);
    return answers.filter((answer) => optionLabels.has(answer));
  });
  const customInputs = normalizedMatrix.map((answers, index) => {
    const optionLabels = getOptionLabelSet(questions[index]);
    return answers.filter((answer) => !optionLabels.has(answer)).join('、');
  });

  return {
    answerMatrix: normalizedMatrix,
    selectedAnswers,
    customInputs,
  };
}

function buildAnswerMatrix(
  questions: QuestionItem[],
  selectedAnswers: QuestionAnswerMatrix,
  customInputs: string[],
): QuestionAnswerMatrix {
  return questions.map((question, index) => {
    const selected = selectedAnswers[index] ?? [];
    const customInput = customInputs[index]?.trim();
    if (question.multiSelect) {
      return customInput ? [...selected, customInput] : selected;
    }
    return customInput ? [customInput] : selected.slice(0, 1);
  });
}

function hasAnyAnswer(answerMatrix: QuestionAnswerMatrix): boolean {
  return answerMatrix.some((answers) => answers.length > 0);
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  messageId,
  onAnswered,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const questions = useMemo(() => buildQuestionItems(part), [part]);
  const initialDraftState = useMemo(
    () => splitAnswerMatrix(questions, getInitialAnswerMatrix(part, questions)),
    [part, questions],
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<QuestionAnswerMatrix>(
    initialDraftState.selectedAnswers,
  );
  const [customInputs, setCustomInputs] = useState<string[]>(initialDraftState.customInputs);
  const [answered, setAnswered] = useState(Boolean(part.answered || hasAnyAnswer(initialDraftState.answerMatrix)));
  const [submitting, setSubmitting] = useState(false);
  const [customFocused, setCustomFocused] = useState(false);

  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];
  const currentSelectedAnswers = selectedAnswers[currentQuestionIndex] ?? [];
  const currentCustomInput = customInputs[currentQuestionIndex] ?? '';
  const trimmedInput = currentCustomInput.trim();
  const requiresManualSubmit = questions.length > 1 || questions.some((question) => question.multiSelect);
  const isLocked = answered || submitting || readonly;

  const buildDisplayContent = (answerMatrix: QuestionAnswerMatrix): string =>
    formatQuestionAnswerDisplay(questions, answerMatrix, {
      unanswered: t('question.unanswered'),
      answerSeparator: t('question.answerSeparator'),
      questionTitle: (index) => t('question.defaultTitle', { index: index + 1 }),
    });

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
    setSelectedAnswers(initialDraftState.selectedAnswers);
    setCustomInputs(initialDraftState.customInputs);
    setAnswered(Boolean(part.answered || hasAnyAnswer(initialDraftState.answerMatrix)));
    setCurrentQuestionIndex(0);
    setCustomFocused(false);
  }, [initialDraftState, part.answered]);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [currentCustomInput, currentQuestionIndex]);

  const submitAnswerMatrix = async (
    answerMatrix: QuestionAnswerMatrix,
    previousSelectedAnswers: QuestionAnswerMatrix,
    previousCustomInputs: string[],
  ) => {
    if (isLocked || !onAnswered) {
      return;
    }

    setSubmitting(true);
    try {
      await onAnswered({
        answer: answerMatrix,
        displayContent: buildDisplayContent(answerMatrix),
        messageId,
        toolCallId: part.toolCallId,
        questionId: part.questionId,
        subagentSessionId: part.subagentSessionId,
      });
      const nextDraftState = splitAnswerMatrix(questions, answerMatrix);
      setSelectedAnswers(nextDraftState.selectedAnswers);
      setCustomInputs(nextDraftState.customInputs);
      setAnswered(true);
    } catch (err) {
      setSelectedAnswers(previousSelectedAnswers);
      setCustomInputs(previousCustomInputs);
      WeLog(`QuestionCard submit answer failed | extra=${JSON.stringify({
        partId: part.partId,
        toolCallId: part.toolCallId,
      })} | error=${JSON.stringify(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitCurrentDraft = () => {
    const answerMatrix = buildAnswerMatrix(questions, selectedAnswers, customInputs);
    void submitAnswerMatrix(answerMatrix, selectedAnswers, customInputs);
  };

  const updateSelectedAnswers = (nextAnswers: string[], shouldSubmitImmediately: boolean) => {
    const previousSelectedAnswers = selectedAnswers;
    const previousCustomInputs = customInputs;
    const nextSelectedAnswers = questions.map((_, index) => (
      index === currentQuestionIndex ? nextAnswers : selectedAnswers[index] ?? []
    ));
    const nextCustomInputs = questions.map((_, index) => (
      index === currentQuestionIndex && !currentQuestion.multiSelect ? '' : customInputs[index] ?? ''
    ));
    setSelectedAnswers(nextSelectedAnswers);
    setCustomInputs(nextCustomInputs);

    if (shouldSubmitImmediately) {
      const answerMatrix = buildAnswerMatrix(questions, nextSelectedAnswers, nextCustomInputs);
      void submitAnswerMatrix(answerMatrix, previousSelectedAnswers, previousCustomInputs);
    }
  };

  const handleSelect = (option: string) => {
    if (isLocked) {
      return;
    }

    if (currentQuestion.multiSelect) {
      const nextAnswers = currentSelectedAnswers.includes(option)
        ? currentSelectedAnswers.filter((answer) => answer !== option)
        : [...currentSelectedAnswers, option];
      updateSelectedAnswers(nextAnswers, false);
      return;
    }

    updateSelectedAnswers([option], !requiresManualSubmit);
  };

  const handleCustomInputChange = (value: string) => {
    const nextCustomInputs = questions.map((_, index) => (
      index === currentQuestionIndex ? value : customInputs[index] ?? ''
    ));
    setCustomInputs(nextCustomInputs);

    if (!currentQuestion.multiSelect && value.trim()) {
      setSelectedAnswers((prev) => questions.map((_, index) => (
        index === currentQuestionIndex ? [] : prev[index] ?? []
      )));
    }
  };

  const handleCustomSubmit = () => {
    if (!trimmedInput || requiresManualSubmit) {
      return;
    }
    const previousSelectedAnswers = selectedAnswers;
    const previousCustomInputs = customInputs;
    const nextSelectedAnswers = questions.map((_, index) => (
      index === currentQuestionIndex ? [] : selectedAnswers[index] ?? []
    ));
    const nextCustomInputs = questions.map((_, index) => (
      index === currentQuestionIndex ? trimmedInput : customInputs[index] ?? ''
    ));
    setSelectedAnswers(nextSelectedAnswers);
    setCustomInputs(nextCustomInputs);
    const answerMatrix = buildAnswerMatrix(questions, nextSelectedAnswers, nextCustomInputs);
    void submitAnswerMatrix(answerMatrix, previousSelectedAnswers, previousCustomInputs);
  };

  const handleCustomCardClick = () => {
    if (isLocked) {
      return;
    }
    textareaRef.current?.focus();
  };

  const handlePreviousQuestion = () => {
    setCurrentQuestionIndex((index) => Math.max(0, index - 1));
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1));
  };

  const renderControl = () => (
    <span className="question-card__option-radio-wrap" aria-hidden="true">
      <span className={currentQuestion.multiSelect ? 'question-card__option-checkbox' : 'question-card__option-radio'} />
    </span>
  );

  const renderAnsweredSummary = () => {
    const answerMatrix = buildAnswerMatrix(questions, selectedAnswers, customInputs);
    return (
      <div className="question-card__answered-list">
        {questions.map((question, index) => {
          const answers = answerMatrix[index] ?? [];
          const title = question.question.trim() || question.header || t('question.defaultTitle', { index: index + 1 });
          return (
            <div className="question-card__answered-item" key={`${title}-${index}`}>
              {question.header ? (
                <div className="question-card__answered-header">{question.header}</div>
              ) : null}
              <div className="question-card__answered-question">{title}</div>
              <div className={`question-card__answered-answer ${answers.length === 0 ? 'is-empty' : ''}`}>
                {answers.length > 0 ? answers.join(t('question.answerSeparator')) : t('question.unanswered')}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (answered) {
    return (
      <div className="question-card question-card--answered">
        {renderAnsweredSummary()}
      </div>
    );
  }

  const isCustomSelected = currentQuestion.multiSelect
    ? customFocused || Boolean(trimmedInput)
    : Boolean(trimmedInput) || (!requiresManualSubmit && customFocused);

  return (
    <div className="question-card">
      {questions.length > 1 ? (
        <div className="question-card__progress">
          {currentQuestionIndex + 1}/{questions.length}
        </div>
      ) : null}
      {currentQuestion.header ? (
        <div className="question-card__header">{currentQuestion.header}</div>
      ) : null}
      <div className="question-card__question">{currentQuestion.question}</div>

      <div className="question-card__options">
        {currentQuestion.options.map((opt, index) => {
          const isSelected = currentSelectedAnswers.includes(opt.label);
          return (
            <button
              key={`${opt.label}-${index}`}
              type="button"
              className={[
                'question-card__option',
                currentQuestion.multiSelect ? 'question-card__option--multi' : '',
                isSelected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleSelect(opt.label);
                });
              }}
              disabled={isLocked}
              aria-pressed={isSelected}
            >
              <div className="question-card__option-main">
                {renderControl()}
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
            currentQuestion.multiSelect ? 'question-card__option--multi' : '',
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
            {renderControl()}
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
                value={currentCustomInput}
                onChange={(event) => handleCustomInputChange(event.target.value)}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
                disabled={isLocked}
                rows={1}
              />
              <button
                type="button"
                className={[
                  'question-card__submit',
                  !trimmedInput || requiresManualSubmit ? 'is-hidden' : '',
                ].filter(Boolean).join(' ')}
                onClick={(event) => {
                  event.stopPropagation();
                  runButtonClickWithDebounce(event, () => {
                    handleCustomSubmit();
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

      {requiresManualSubmit ? (
        <div className="question-card__footer">
          {questions.length > 1 ? (
            <div className="question-card__nav">
              <button
                type="button"
                className="question-card__nav-button"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                {t('question.previous')}
              </button>
              <button
                type="button"
                className="question-card__nav-button"
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                {t('question.next')}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="question-card__answer-submit"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                submitCurrentDraft();
              });
            }}
            disabled={isLocked}
          >
            {t('question.submitAnswers')}
          </button>
        </div>
      ) : null}
    </div>
  );
};
