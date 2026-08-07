import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, CheckCircle, ArrowRight, Building, Users, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="py-8 md:py-12 px-4 max-w-7xl mx-auto">
      {/* Hero секция */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl p-6 md:p-12 shadow-xl mb-10 text-center md:text-left relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Форум 2025
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Добро пожаловать в систему проживания <span className="text-sky-400">Алабуга</span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg mb-8 leading-relaxed">
            Интерактивный сервис бронирования жилых помещений, работы с командами и расселения участников форума в реальном времени.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 no-underline"
              >
                <span>Перейти в личный кабинет</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 no-underline"
              >
                <span>Войти / Зарегистрироваться</span>
                <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Карточки преимуществ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="card p-6 flex flex-col items-center text-center hover:border-sky-200 transition-all">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4">
            <Shield size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Безопасность</h3>
          <p className="text-sm text-slate-600">Надежная защита данных и распределение ролей участников форума.</p>
        </div>

        <div className="card p-6 flex flex-col items-center text-center hover:border-sky-200 transition-all">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4">
            <Zap size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Скорость и интерактивность</h3>
          <p className="text-sm text-slate-600">Наглядные интерактивные схемы корпусов и моментальная обработка заявок.</p>
        </div>

        <div className="card p-6 flex flex-col items-center text-center hover:border-sky-200 transition-all">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4">
            <CheckCircle size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Командная работа</h3>
          <p className="text-sm text-slate-600">Общие чаты, календари событий и совместное расселение команд.</p>
        </div>
      </div>
    </div>
  );
};