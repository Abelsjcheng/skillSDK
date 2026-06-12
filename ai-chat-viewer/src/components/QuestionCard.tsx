import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import sendQuestionIcon from '../imgs/send_question_icon.svg';
import type { QuestionCardProps } from '../types/components';
import type { MessagePart, QuestionAnswerMatrix, QuestionItem, QuestionOption } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { WeLog } from '../utils/logger';

interface RenderQuestion {
  header?: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

interface QuestionDraft {
  selectedOptions: string[];
  customInput: string;
}

function getAnswerText(part: MessagePart): string {
  return typeof part.output === 'string' ? part.output.trim() : '';
}

function normalizeRenderQuestion(item: QuestionItem): RenderQuestion | null {
  const question = typeof item.question === 'string' ? item.question : '';
  const header = typeof item.header === 'string' ? item.header : undefined;
  const options = Array.isArray(item.options) ? item.options : [];
  const multiSelect = item.multiSelect === true;

  if (!question && !header && options.length === 0) {
    return null;
  }

  return {
    ...(header ? { header } : {}),
    question,
    options,
    multiSelect,
  };
}

function getRenderQuestions(part: MessagePart): RenderQuestion[] {
  const questionItems = Array.isArray(part.questions)
    ? part.questions.map(normalizeRenderQuestion).filter((item): item is RenderQuestion => Boolean(item))
    : [];

  if (questionItems.length > 0) {
    return questionItems;
  }

  const legacyQuestion = normalizeRenderQuestion({
    header: part.header,
    question: part.question ?? part.content,
    options: part.options,
    multiSelect: part.multiSelect === true,
  });
  return legacyQuestion ? [legacyQuestion] : [];
}

function optionLabels(question: RenderQuestion): Set<string> {
  return new Set(question.options.map((option) => option.label));
}

function createAnswerMatrixFromOutput(part: MessagePart, questions: RenderQuestion[]): QuestionAnswerMatrix {
  const answers = questions.map(() => [] as string[]);
  const answerText = getAnswerText(part);
  if (answerText && answers.length > 0) {
    answers[0] = [answerText];
  }
  return answers;
}

function createDraftsFromAnswers(questions: RenderQuestion[], answers: QuestionAnswerMatrix): QuestionDraft[] {
  return questions.map((question, index) => {
    const labels = optionLabels(question);
    const answerItems = answers[index] ?? [];
    const selectedOptions = answerItems.filter((item) => labels.has(item));
    const customAnswers = answerItems.filter((item) => !labels.has(item));
    return {
      selectedOptions,
      customInput: customAnswers.join('、'),
    };
  });
}

function buildAnswerMatrix(questions: RenderQuestion[], drafts: QuestionDraft[]): QuestionAnswerMatrix {
  return questions.map((question, index) => {
    const draft = drafts[index] ?? { selectedOptions: [], customInput: '' };
    const customAnswer = draft.customInput.trim();
    const answers = question.multiSelect ? [...draft.selectedOptions] : draft.selectedOptions.slice(0, 1);
    if (customAnswer) {
      if (question.multiSelect) {
        answers.push(customAnswer);
      } else {
        return [customAnswer];
      }
    }
    return answers;
  });
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  part,
  messageId,
  onAnswered,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const submittedLocallyRef = useRef(false);
  const questions = useMemo(() => getRenderQuestions(part), [part]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() => createDraftsFromAnswers(
    questions,
    createAnswerMatrixFromOutput(part, questions),
  ));
  const [answered, setAnswered] = useState(Boolean(part.answered || getAnswerText(part)));
  const [submitting, setSubmitting] = useState(false);
  const [customFocused, setCustomFocused] = useState(false);

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const currentDraft = drafts[currentIndex] ?? { selectedOptions: [], customInput: '' };
  const isSingleQuestionSingleSelect = questions.length === 1 && !currentQuestion?.multiSelect;
  const isLocked = answered || submitting || readonly;
  const trimmedInput = currentDraft.customInput.trim();
  const isCustomSelected = Boolean(trimmedInput) || (!answered && customFocused);

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
    if (submittedLocallyRef.current && (part.answered || getAnswerText(part))) {
      setAnswered(true);
      return;
    }

    const nextAnswers = createAnswerMatrixFromOutput(part, questions);
    setAnswered(Boolean(part.answered || getAnswerText(part)));
    setDrafts(createDraftsFromAnswers(questions, nextAnswers));
    setCurrentIndex(0);
  }, [part, questions]);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [currentDraft.customInput, currentIndex]);

  const updateDraftAt = (index: number, updater: (draft: QuestionDraft) => QuestionDraft): QuestionDraft[] => {
    const nextDrafts = [...drafts];
    const current = nextDrafts[index] ?? { selectedOptions: [], customInput: '' };
    nextDrafts[index] = updater(current);
    return nextDrafts;
  };

  const submitAnswers = async (answers: QuestionAnswerMatrix, nextDrafts: QuestionDraft[]) => {
    if (isLocked || !onAnswered || questions.length === 0) {
      return;
    }

    const previousDrafts = drafts;
    setDrafts(nextDrafts);
    setSubmitting(true);
    try {
      await onAnswered({
        answer: answers,
        messageId,
        toolCallId: part.toolCallId,
        questionId: part.questionId,
        subagentSessionId: part.subagentSessionId,
      });
      submittedLocallyRef.current = true;
      setAnswered(true);
      setDrafts(createDraftsFromAnswers(questions, answers));
    } catch (err) {
      setDrafts(previousDrafts);
      WeLog(`QuestionCard submit answer failed | extra=${JSON.stringify({
        partId: part.partId,
        toolCallId: part.toolCallId,
      })} | error=${JSON.stringify(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion || isLocked) {
      return;
    }

    const nextDrafts = updateDraftAt(currentIndex, (draft) => {
      if (currentQuestion.multiSelect) {
        const exists = draft.selectedOptions.includes(option);
        return {
          ...draft,
          selectedOptions: exists
            ? draft.selectedOptions.filter((item) => item !== option)
            : [...draft.selectedOptions, option],
        };
      }

      return {
        selectedOptions: [option],
        customInput: '',
      };
    });
    setDrafts(nextDrafts);

    if (isSingleQuestionSingleSelect) {
      void submitAnswers(buildAnswerMatrix(questions, nextDrafts), nextDrafts);
    }
  };

  const handleCustomInputChange = (value: string) => {
    if (!currentQuestion || isLocked) {
      return;
    }

    setDrafts(updateDraftAt(currentIndex, (draft) => ({
      selectedOptions: currentQuestion.multiSelect ? draft.selectedOptions : [],
      customInput: value,
    })));
  };

  const handleCustomSubmit = () => {
    if (!trimmedInput || !isSingleQuestionSingleSelect) {
      return;
    }
    const nextDrafts = updateDraftAt(currentIndex, () => ({
      selectedOptions: [],
      customInput: trimmedInput,
    }));
    void submitAnswers(buildAnswerMatrix(questions, nextDrafts), nextDrafts);
  };

  const handleSubmitAll = () => {
    void submitAnswers(buildAnswerMatrix(questions, drafts), drafts);
  };

  const handleCustomCardClick = () => {
    if (isLocked) {
      return;
    }
    textareaRef.current?.focus();
  };

  if (!currentQuestion) {
    return null;
  }

  const progressText = t('question.progress', {
    current: currentIndex + 1,
    total: questions.length,
  });

  return (
    <div className={`question-card ${answered ? 'question-card--answered' : ''}`}>
      <div className="question-card__topline">
        {currentQuestion.header ? (
          <div className="question-card__header">{currentQuestion.header}</div>
        ) : null}
        {questions.length > 1 ? (
          <div className="question-card__progress">{progressText}</div>
        ) : null}
      </div>
      <div className="question-card__question">{currentQuestion.question}</div>

      <div className="question-card__options">
        {currentQuestion.options.map((opt, index) => {
          const isSelected = currentDraft.selectedOptions.includes(opt.label);
          return (
            <button
              key={`${opt.label}-${index}`}
              type="button"
              className={`question-card__option ${isSelected ? 'is-selected' : ''}`}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleOptionSelect(opt.label);
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
                value={currentDraft.customInput}
                onChange={(event) => handleCustomInputChange(event.target.value)}
                onFocus={() => setCustomFocused(true)}
                onBlur={() => setCustomFocused(false)}
                disabled={isLocked}
                rows={1}
              />
              {isSingleQuestionSingleSelect ? (
                <button
                  type="button"
                  className={`question-card__submit ${!trimmedInput ? 'is-hidden' : ''}`}
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
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!isSingleQuestionSingleSelect && !answered ? (
        <div className="question-card__footer">
          {questions.length > 1 ? (
            <button
              type="button"
              className="question-card__nav"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={isLocked || currentIndex === 0}
            >
              {t('question.prevQuestion')}
            </button>
          ) : null}
          {questions.length > 1 && currentIndex < questions.length - 1 ? (
            <button
              type="button"
              className="question-card__nav question-card__nav--primary"
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={isLocked}
            >
              {t('question.nextQuestion')}
            </button>
          ) : (
            <button
              type="button"
              className="question-card__nav question-card__nav--primary"
              onClick={handleSubmitAll}
              disabled={isLocked}
            >
              {t('common.submit')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
