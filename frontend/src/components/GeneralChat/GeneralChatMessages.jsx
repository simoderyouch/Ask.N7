import React, { useEffect, useRef } from 'react';
import { MessageBubble } from '../shared/MessageBubble';
import { HiOutlineSparkles } from "react-icons/hi";
import Loading from '../ui/Loading';

/**
 * Messages component for GeneralChat
 */
export const GeneralChatMessages = React.memo(({
  messages,
  isLoading,
  showingLetters,
  currentIndex,
  chatEndRef,
  onSuggestionClick,
}) => {
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatEndRef]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4" aria-live="polite" aria-label="Chat messages">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
            <HiOutlineSparkles className="text-primary text-4xl" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Ask.N7</h3>
          <p className="text-gray-500 max-w-md mb-6">
            Votre assistant universitaire intelligent. Posez vos questions sur la scolarité, les procédures administratives, ou la vie étudiante.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => onSuggestionClick?.("Quels sont les documents requis pour l'inscription ?")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              aria-label="Documents inscription"
            >
              Documents inscription
            </button>
            <button
              onClick={() => onSuggestionClick?.("Quelles sont les filières disponibles ?")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              aria-label="Filières"
            >
              Filières
            </button>
            <button
              onClick={() => onSuggestionClick?.("Comment obtenir une attestation de scolarité ?")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              aria-label="Attestation scolarité"
            >
              Attestation scolarité
            </button>
          </div>
        </div>
      ) : (
        messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          return (
            <MessageBubble
              key={index}
              isUser={message.is_user_message}
              content={message.message}
              timestamp={message.create_at}
              showTyping={showingLetters && isLastMessage}
              typingIndex={currentIndex}
              documentsUsed={message.documents_used}
              chatEndRef={chatEndRef}
              isLastMessage={isLastMessage}
            />
          );
        })
      )}
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[73%] text-sm py-2 rounded-md px-3 flex gap-3 items-center">
            <Loading color="#9ca3af" />
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
});

GeneralChatMessages.displayName = "GeneralChatMessages";

