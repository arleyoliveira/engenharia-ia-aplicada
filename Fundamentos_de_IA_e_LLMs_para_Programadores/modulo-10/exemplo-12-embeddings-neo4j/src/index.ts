import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { CONFIG } from './config.ts';
import { DocumentProcessor } from './documentProcessor.ts';
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import type { PretrainedModelOptions } from "@huggingface/transformers";
import { displayResults } from './util.ts';

let _neo4jVectorStore = null;

async function clearAll(vectorStore: Neo4jVectorStore, nodeLabel: string) {
    console.log("🗑️  Removendo todos os documentos existentes...");
    await vectorStore.query(`MATCH (n:${nodeLabel}) DETACH DELETE n`);
    console.log("✅ Documentos removidos com sucesso\n");
}

try {
    console.log("🚀 Inicializando sistema de Embeddings com Neo4j...\n");

    const documentProcessor = new DocumentProcessor(
        CONFIG.pdf.path,
        CONFIG.textSplitter
    );

    const documents = await documentProcessor.loadAndSplit();
    
    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: CONFIG.embedding.modelName,
        pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedModelOptions
    });

    // Testando a geração de embeddings para uma consulta
    // const response = await embeddings.embedQuery("Javascript")
    
    // Testando a geração de embeddings para um documento
    // const response = await embeddings.embedDocuments([
    //     "Javascript"
    // ])
    //console.log('response:', response);

    _neo4jVectorStore = await Neo4jVectorStore.fromExistingGraph(
        embeddings,
        CONFIG.neo4j
    )
    clearAll(_neo4jVectorStore, CONFIG.neo4j.nodeLabel);

    for(const [index, doc] of documents.entries()) {
        console.log(`✅ Processando documento ${index + 1}/${documents.length}...`);
        await _neo4jVectorStore.addDocuments([doc]);
    }
    console.log("\n✅ Todos os documentos processados com sucesso!");

    // =========== STEP 2: Consulta de Similaridade ===========
    const questions = [
        //"o que é hot encoding e quando usar?",
        //"o que significa treinar uma rede neural?"
        "O que são tensores e como são representados em JavaScript?",
        "Como converter objetos JavaScript em tensores?",
        "O que é normalização de dados e por que é necessária?",
        "Como funciona uma rede neural no TensorFlow.js?",
        "O que significa treinar uma rede neural?",
        "o que é hot enconding e quando usar?"
    ]

    for(const question of questions) {
        console.log(`\n{'='.repeat(80)}\n`);
        console.log(`❓ Pergunta: ${question}\n`);
        console.log('='.repeat(80));

        const results = await _neo4jVectorStore.similaritySearch(question, CONFIG.similarity.topK);
        console.log(`🔍 Resultados para: "${question}"`);
        displayResults(results);
    }
} catch (error) {
    console.error('An error occurred:', error);
} finally {
    _neo4jVectorStore?.close()
}