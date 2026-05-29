export default function GithubButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:opacity-95"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.2 9.2 7.6 10.7.6.1.8-.3.8-.6v-2.1c-3.1.7-3.7-1.4-3.7-1.4-.5-1.2-1.3-1.5-1.3-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 1.6 2.8 1.1.1-.8.4-1.4.7-1.7-2.5-.3-5.1-1.2-5.1-5.4 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3 0 0 .9-.3 3 .1.8-.2 1.7-.3 2.6-.3s1.8.1 2.6.3c2.1-.4 3-.1 3-.1.6 1.5.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.2-2.6 5.1-5.1 5.4.4.3.8 1 .8 2v3c0 .3.2.7.8.6 4.4-1.5 7.6-5.7 7.6-10.7C23.4 5.6 18.3.5 12 .5z" />
      </svg>
      Entrar com GitHub
    </button>
  );
}
