import React, { useState } from 'react';
import type { MessagePart } from '../types';
import { sendMessage } from '../utils/hwext';

interface QuestionCardProps {
  part: MessagePart;
  welinkSessionId: number;
  onAnswered?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  part, 
  welinkSessionId,
  onAnswered 
}) => {
  const [customInput, setCustomInput] = useState('');
  const [answered, setAnswered] = useState(part.answered ?? false);
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = async (option: string) => {
    if (answered || submitting) return;
    setSubmitting(true);
    try {
      await sendMessage({
        welinkSessionId,
        content: option,
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

  const handleSubmit = async () => {
    if (answered || submitting || !customInput.trim()) return;
    setSubmitting(true);
    try {
      await sendMessage({
        welinkSessionId,
        content: customInput.trim(),
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
              className="question-card__option"
              onClick={() => handleSelect(opt)}
              disabled={answered || submitting}
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
          disabled={answered || submitting}
        />
        <button
          className="question-card__submit"
          onClick={handleSubmit}
          disabled={answered || submitting || !customInput.trim()}
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
