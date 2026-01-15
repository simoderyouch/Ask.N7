import { GoArrowRight, GoShield } from "react-icons/go";
import { HiOutlineDocumentText, HiOutlineSparkles, HiOutlineLightningBolt } from "react-icons/hi";
import useAuthStore from '../stores/authStore';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from "./shared/navBar.jsx";
import { useState } from 'react';

const Landing = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [question, setQuestion] = useState("");
  const navigate = useNavigate();

  const handleQuestionSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    if (token && user) {
      navigate('/chat', { state: { question } });
    } else {
      localStorage.setItem('pendingQuestion', question);
      navigate('/user/login');
    }
  };

  const features = [
    {
      icon: <HiOutlineLightningBolt className="w-6 h-6" />,
      title: "Réponses Instantanées",
      description: "Posez vos questions naturellement comme à un ami et obtenez une réponse immédiate."
    },
    {
      icon: <HiOutlineSparkles className="w-6 h-6" />,
      title: "Toujours Disponible",
      description: "Accessible 24/7, soirs, weekends et vacances inclus. Ask.N7 ne dort jamais."
    },
    {
      icon: <GoShield className="w-6 h-6" />,
      title: "Informations Fiables",
      description: "Basé uniquement sur les documents officiels de l'administration. Pas d'hallucinations."
    },
    {
      icon: <HiOutlineDocumentText className="w-6 h-6" />,
      title: "Accès Centralisé",
      description: "Fini la recherche dans les emails et panneaux d'affichage. Tout est ici."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23711037' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      <NavBar />

      {/* Hero Section */}
      <main className="relative">
        <div className="container max-w-6xl mx-auto px-6 pt-16 pb-24">
          {/* Hero Content */}
          <div className="text-center mb-16 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-8 border border-primary/20">
              <HiOutlineSparkles className="w-4 h-4" />
              <span>Propulsé par l'Intelligence Artificielle</span>
            </div>

            {/* Main Heading */}
            <h1 className="font-bold text-5xl md:text-6xl lg:text-7xl leading-[3.3rem] tracking-tighter mb-6 text-slate-900">
              <span className="block text-primary bg-clip-text">
                Ask.N7
              </span>
              <span className="block mt-2 text-4xl md:text-5xl lg:text-6xl">
                Votre Assistant Universitaire Intelligent
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-7 mb-4">
              Le hub central pour toutes les informations de l'ENSET.
              Obtenez des réponses instantanées, précises et fiables 24/7 sur les emplois du temps, procédures et règlements.
            </p>
          </div>

          {/* Input Zone */}
          <div
            className="max-w-3xl mx-auto animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="relative">
              <form onSubmit={handleQuestionSubmit} className="relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Posez votre question ici... (ex: Quand sont les examens?)"
                  className="w-full px-8 py-6 rounded-2xl bg-white border-2 border-slate-200 outline-none text-lg shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="absolute right-3 top-3 bottom-3 px-6 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Demander
                  <GoArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* CTA below input */}
            {!token && (
              <div className="text-center mt-6">
                <p className="text-slate-500">
                  Vous avez déjà un compte?{' '}
                  <Link to="/user/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                    Connectez-vous
                    <GoArrowRight className="w-4 h-4" />
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* How it works section */}
          <div className="mt-32 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Comment ça marche?</h2>
            <p className="text-slate-500 mb-12 max-w-xl mx-auto">
              Trois étapes simples pour commencer à interagir avec vos documents
            </p>

            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4">
              {/* Step 1 */}
              <div className="flex flex-col items-center max-w-xs animate-fade-in" style={{ animationDelay: '400ms' }}>
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 shadow-md shadow-primary/30">
                  1
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Connectez-vous</h3>
                <p className="text-sm text-slate-500">Créez votre compte pour accéder à l'assistant</p>
              </div>

              {/* Connector */}
              <div className="hidden md:block w-24 h-0.5 bg-gradient-to-r from-primary to-primary/30 rounded-full" />

              {/* Step 2 */}
              <div className="flex flex-col items-center max-w-xs animate-fade-in" style={{ animationDelay: '500ms' }}>
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 shadow-md shadow-primary/30">
                  2
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Analysez</h3>
                <p className="text-sm text-slate-500">Notre IA analyse et indexe le contenu automatiquement</p>
              </div>

              {/* Connector */}
              <div className="hidden md:block w-24 h-0.5 bg-gradient-to-r from-primary/30 to-primary rounded-full" />

              {/* Step 3 */}
              <div className="flex flex-col items-center max-w-xs animate-fade-in" style={{ animationDelay: '600ms' }}>
                <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 shadow-md shadow-primary/30">
                  3
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Chatbot N7</h3>
                <p className="text-sm text-slate-500">Posez vos questions à l'IA et obtenez des réponses précises</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-32 text-center animate-fade-in" style={{ animationDelay: '700ms' }}>
            <div className="inline-flex flex-col sm:flex-row items-center gap-14 p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 mb-1">Prêt à commencer?</h3>
                <p className="text-slate-500">Créez votre compte gratuitement et explorez vos documents</p>
              </div>
              <Link
                to="/user/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-sm shadow-primary/30 hover:shadow-md hover:shadow-primary/40 hover:-translate-y-0.5"
              >
                S'inscrire gratuitement
                <GoArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 mt-16">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>© 2025 By Mohamed ED DERYOUCH. Tous droits réservés.</p>
            <div className="flex items-center gap-6">
              <button type="button" className="hover:text-primary transition-colors cursor-pointer">Confidentialité</button>
              <button type="button" className="hover:text-primary transition-colors cursor-pointer">Conditions</button>
              <button type="button" className="hover:text-primary transition-colors cursor-pointer">Contact</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
