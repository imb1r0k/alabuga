// Удаляем useEffect со scrollIntoView
// Было:
// useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
// Удалили (или заменили на условный скролл только вниз, но пользователь просил убрать автоскролл)