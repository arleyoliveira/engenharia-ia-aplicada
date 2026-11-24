import os
from dotenv import load_dotenv
from crewai import LLM

load_dotenv()

# Prioriza OpenRouter se a chave estiver presente, senão usa Groq
if os.getenv("GEMINI_API_KEY"):
    nexus_llm = LLM(
        model=os.getenv("GEMINI_MODEL", "gemini/google/gemini-2.5-flash"),
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.2
    )
elif os.getenv("OPENROUTER_API_KEY"):
    nexus_llm = LLM(
        model=os.getenv("OPENROUTER_MODEL", "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"),
        api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=0.2
    )
else:
    nexus_llm = LLM(
        model=os.getenv("GROQ_MODEL", "groq/openai/gpt-oss-120b"),
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.2
    )