import tf from '@tensorflow/tfjs-node';

async function trainModel(inputXs, outputYs) {
    const model = tf.sequential()

    //primeira camada da rede
    //entrada de 7 posições (idade normalizada + 3 cores + 3 localizações)

    //80 neuronios = aqui coloquei tudo isso, pq tem pouca base de treino
    //quanto mais neuronios, mais complexidade a rede pode aprender
    //e consequentemente, mais processamento ela vai suar

    //A ReLU age como um filtro:
    //É como ela deixasse somente os dados interessantes seguirem viagem na rede
    //Se a informação chegou neste neuronio é positiva, passsa para frente!
    //Se for zero ou negativa, pode jogar fora, não vai servir para nada
    model.add(tf.layers.dense({ inputShape: [7], units: 80, activation: 'relu' }))

    //Saída: 3 neuronios
    //Um para cada categoria (premium, medium, basic)

    //Activation: softmax normaliza a saida em probabilidades
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }))

    //Compilando o modelo
    //Optimizer Adam (Adaptive Moment Estimation)
    //É um treinador pessoal moderno para redes neurais:
    //Ajusta os pesos de forma eficiente e inteligente
    //Aprende com histórico de erros e acertos,


    //loss: categoricalCrossentropy
    //Ele compara o que o modelo "acha" (os scores de cada categoria)
    //Com a resposta certa
    //A categoria premium será sempre [1, 0, 0]

    //quanto mais distante da previsão do modelo da resposta correta
    //maior o erros (loss)
    //Exemplo classico: classifcação de imagens, recomendação, categorização de
    //Usuário
    //Qualquer coisa em que a resposta certa é "apenas um entre várias possíveis" 
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    })

    await model.fit(
        inputXs,
        outputYs,
        {
            verbose: 0, //desabilita o log interno
            epochs: 100, //quantidade de vezes que executará a lista (dataset)
            shuffle: true, //embaralha para ter diferentes forma de treinar e não ficar enviesado 
            // callbacks: {
            //     onEpochEnd: (epoch, log) => console.log(
            //         `Epoch: ${epoch} loss = ${log.loss}`
            //     )
            // }
        }
    )
    return model
}

async function predict(model, pessoa) {
    //transformar o array js para o tensor (tfjs)

    const tfInput = tf.tensor2d(pessoa)

    //Faz a predição (output será um vetor de 3 probabilidade)
    const pred = model.predict(tfInput)
    const predArray = await pred.array()
    console.log(predArray)

    return predArray[0].map((prob, index) => ({prob, index}))
}

// Exemplo de pessoas para treino (cada pessoa com idade, cor e localização)
// const pessoas = [
//     { nome: "Erick", idade: 30, cor: "azul", localizacao: "São Paulo" },
//     { nome: "Ana", idade: 25, cor: "vermelho", localizacao: "Rio" },
//     { nome: "Carlos", idade: 40, cor: "verde", localizacao: "Curitiba" }
// ];

// Vetores de entrada com valores já normalizados e one-hot encoded
// Ordem: [idade_normalizada, azul, vermelho, verde, São Paulo, Rio, Curitiba]
// const tensorPessoas = [
//     [0.33, 1, 0, 0, 1, 0, 0], // Erick
//     [0, 0, 1, 0, 0, 1, 0],    // Ana
//     [1, 0, 0, 1, 0, 0, 1]     // Carlos
// ]

// Usamos apenas os dados numéricos, como a rede neural só entende números.
// tensorPessoasNormalizado corresponde ao dataset de entrada do modelo.
const tensorPessoasNormalizado = [
    [0.33, 1, 0, 0, 1, 0, 0], // Erick
    [0, 0, 1, 0, 0, 1, 0],    // Ana
    [1, 0, 0, 1, 0, 0, 1]     // Carlos
]

// Labels das categorias a serem previstas (one-hot encoded)
// [premium, medium, basic]
const labelsNomes = ["premium", "medium", "basic"]; // Ordem dos labels
const tensorLabels = [
    [1, 0, 0], // premium - Erick
    [0, 1, 0], // medium - Ana
    [0, 0, 1]  // basic - Carlos
];

// Criamos tensores de entrada (xs) e saída (ys) para treinar o modelo
const inputXs = tf.tensor2d(tensorPessoasNormalizado)
const outputYs = tf.tensor2d(tensorLabels)

//quanto mais dados melhor
//assim o algoritmo consegue entender melhor os padrões complexos
//dos dados
const model = await trainModel(inputXs, outputYs)

const pessoa = { nome: "Pedro", idade: 30, cor: "azul", localizacao: "São Paulo" }
const pessoaTensorNormalizado = [
    [
        0.33, //idade normalizada
        0, // cor azul
        0, // cor vermelho
        1, // cor verde
        1, // localização São Paulo
        0, // localização Rio
        0  // localização Curitiba
    ]

]

//Normalizando a idade da nova pessoa usando o mesmo padrão do treino
//Exemplo: idade_min = 25, idade_max = 40, fórmula: (idade - idade_min) / (idade_max - idade min)
//Calculo: idade_normalizada = (28 - 25) / (40 - 25) = 0.20
const predicitons = await predict(model, pessoaTensorNormalizado)

const results = predicitons.sort((a, b) => b.prob - a.prob)
.map(p => `index: ${p.index} - ${labelsNomes.at(p.index)} (${(p.prob * 100).toFixed(2)}%)`)
.join('\n')

console.log(results)

//inputXs.print();
//outputYs.print();