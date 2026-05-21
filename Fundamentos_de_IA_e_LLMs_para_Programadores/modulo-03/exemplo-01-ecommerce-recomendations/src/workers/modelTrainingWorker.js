import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('Model training worker initialized');
let _globalCtx = {};
let _model = {};

const WEIGHTS = {
    category: 0.4,
    color: 0.3,
    price: 0.2,
    age: 0.1
}

//Normalize continuos values (price, age) to 0-1 range
//Why? Keeps all features balanced so no on dominates training
//Formula: (val - min) / (max - min)
//Example: price=129.99, minPrice=39.99, maxPrice=199.99 -> 0.56
const normalize = (value, min, max) => (value - min) / ((max - min) || 1)

function makeContext(products, users) {
    const ages = users.map(u => u.age)
    const prices = products.map(p => p.price)

    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    const colors = [...new Set(products.map(p => p.color))]
    const categories = [... new Set(products.map(p => p.category))]

    const colorsIndex = Object.fromEntries(
        colors.map((color, index) => {
            return [color, index]
        })
    )

    const categoriesIndex = Object.fromEntries(
        categories.map((category, index) => {
            return [category, index]
        })
    )

    //Computar a média de idade dos compradores por produto
    // (ajuda a personalizar)
    const midAge = (minAge + maxAge) / 2
    const ageSums = {}
    const ageCounts = {}

    users.forEach(user => {
        user.purchases.forEach(p => {
            ageSums[p.name] = (ageSums[p.name] || 0) + user.age
            ageCounts[p.name] = (ageCounts[p.name] || 0) + 1
        })
    });

    const productAvgAgeNorm = Object.fromEntries(
        products.map(product => {
            const avg = ageCounts[product.name]
                ? ageSums[product.name] / ageCounts[product.name]
                : midAge
            return [product.name, normalize(avg, minAge, maxAge)]
        })

    )

    return {
        products,
        users,
        colorsIndex,
        categoriesIndex,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        numCategories: categories.length,
        numColors: colors.length,
        dimentions: 2 + categories.length + colors.length, //price + age + colors + categories
        productAvgAgeNorm
    }
}

const oneHotWeighted = (index, length, weight) => tf.oneHot(index, length).cast('float32').mul(weight)

function encodeProduct(product, context) {
    //Normalizando dados para ficar de 0 a 1
    //aplicação peso na recomendação
    const price = tf.tensor1d([
        normalize(
            product.price,
            context.minPrice,
            context.maxPrice
        ) * WEIGHTS.price
    ])

    const age = tf.tensor1d([
        (
            context.productAvgAgeNorm[product.name] ?? 0.5
        ) * WEIGHTS.age
    ])

    const category = oneHotWeighted(
        context.categoriesIndex[product.category],
        context.numCategories,
        WEIGHTS.category
    )

    const color = oneHotWeighted(
        context.colorsIndex[product.color],
        context.numColors,
        WEIGHTS.color
    )
    return tf.concat1d(
        [
            price,
            age,
            category,
            color
        ]
    )
}
function encodedUser(user, context) {
    if (user.purchases.length) {
        return tf.stack(
            user.purchases.map(product => encodeProduct(product, context))
        )
            .mean(0)
            .reshape([
                1,
                context.dimentions
            ])
    }
}

function createTrainingData(context) {
    const inputs = []
    const labels = []
    context.users
        .filter(u => u.purchases.length)
        .forEach(user => {
            const userVector = encodedUser(user, context).dataSync()
            context.products.forEach(product => {
                const productVector = encodeProduct(product, context).dataSync()

                const label = user.purchases.some(
                    purchase => purchase.name === product.name ? 1 : 0
                )

                //combinar user + product
                inputs.push([...userVector, ...productVector])
                labels.push(label)
            })
        })
    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        inputDimention: context.dimentions * 2 //tamanho = userVector + productVector
    }
}


//Configuração e treinamento da rede neural
async function configureNeuralNetAndTrain(trainData) {
    const model = tf.sequential()

    model.add(
        tf.layers.dense({
            inputShape: [trainData.inputDimention],
            units: 128, //experimental (muitos olhos para detectar padrões)
            activation: 'relu' // mantém apenas sinais positivos, ajuda a aprender padrões não lineares
        })
    )

    //camadas serve para aprender mais, uma vez que serão removido os negativos, como se fosse uma espécie de filtro
    model.add(
        tf.layers.dense({
            units: 64, //experimental (muitos olhos para detectar padrões)
            activation: 'relu' // mantém apenas sinais positivos, ajuda a aprender padrões não lineares
        })
    )
    model.add(
        tf.layers.dense({
            units: 32, //experimental (muitos olhos para detectar padrões)
            activation: 'relu' // mantém apenas sinais positivos, ajuda a aprender padrões não lineares
        })
    )

    //camada de saída
    model.add(
        tf.layers.dense({
            units: 1, //somente um dado, pois quero saber apenas da propabilidade que o usuário tem para comprar determinado produto
            activation: 'sigmoid' //ordena com a lista com da maior para menor probabilidade
        })
    )

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    })

    await model.fit(trainData.xs, trainData.ys, {
        epochs: 100, //quantidade que o modelo irá rodar com a base de dados
        batchSize: 32, //quantidade de dados por vez que serão treinados
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch: epoch,
                    loss: logs.loss,
                    accuracy: logs.acc
                });
            }
        }
    })
}

async function trainModel({ users }) {
    console.log('Training model with users:', users)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });

    const products = await (await fetch('/data/products.json')).json()

    const context = makeContext(products, users)

    context.productVectors = products.map(product => {
        return {
            name: product.name,
            meta: { ...product },
            vector: encodeProduct(product, context).dataSync()
        }
    })

    _globalCtx = context

    const trainData = createTrainingData(context)
    _model = await configureNeuralNetAndTrain(trainData)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
    postMessage({ type: workerEvents.trainingComplete });


}
function recommend(user, ctx) {
    console.log('will recommend for user:', user)
    // postMessage({
    //     type: workerEvents.recommend,
    //     user,
    //     recommendations: []
    // });
}


const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: d => recommend(d.user, _globalCtx),
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
