/**
 * Train a model given algorithm ID, data, and hyperparameters.
 */
export function trainModel(algorithmId, xTrain, yTrain, xTest, yTest, hyperparams, featureNames) {
    switch (algorithmId) {
        case 'linear-regression':
            return trainLinearRegression(xTrain, yTrain, xTest, yTest, hyperparams);
        case 'logistic-regression':
            return trainLogisticRegression(xTrain, yTrain, xTest, yTest, hyperparams);
        case 'decision-tree':
            return trainDecisionTree(xTrain, yTrain, xTest, yTest, hyperparams, featureNames);
        case 'knn':
            return trainKNN(xTrain, yTrain, xTest, yTest, hyperparams);
        case 'kmeans':
            return trainKMeans(xTrain, xTest, hyperparams);
        case 'naive-bayes':
            return trainNaiveBayes(xTrain, yTrain, xTest, yTest, hyperparams);
        case 'random-forest':
            return trainRandomForest(xTrain, yTrain, xTest, yTest, hyperparams, featureNames);
        case 'gradient-boosting':
            return trainGradientBoosting(xTrain, yTrain, xTest, yTest, hyperparams, featureNames);
        default:
            throw new Error(`No built-in trainer for algorithm: ${algorithmId}. Use external bridge.`);
    }
}
// ─── Linear Regression ──────────────────────────────────────
function trainLinearRegression(xTrain, yTrain, xTest, yTest, hp) {
    const lr = hp.learningRate ?? 0.01;
    const epochs = hp.epochs ?? 100;
    const nFeatures = xTrain[0].length;
    // Initialize weights and bias
    const weights = new Float64Array(nFeatures);
    let bias = 0;
    // Gradient descent
    const m = xTrain.length;
    for (let epoch = 0; epoch < epochs; epoch++) {
        const gradW = new Float64Array(nFeatures);
        let gradB = 0;
        for (let i = 0; i < m; i++) {
            let pred = bias;
            for (let j = 0; j < nFeatures; j++)
                pred += weights[j] * xTrain[i][j];
            const error = pred - yTrain[i];
            gradB += error;
            for (let j = 0; j < nFeatures; j++)
                gradW[j] += error * xTrain[i][j];
        }
        bias -= (lr * gradB) / m;
        for (let j = 0; j < nFeatures; j++)
            weights[j] -= (lr * gradW[j]) / m;
    }
    const predict = (input) => input.map((row) => {
        let pred = bias;
        for (let j = 0; j < nFeatures; j++)
            pred += weights[j] * row[j];
        return pred;
    });
    const predictions = predict(xTest);
    const metrics = computeRegressionMetrics(predictions, yTest);
    return { metrics, predict };
}
// ─── Logistic Regression ────────────────────────────────────
function trainLogisticRegression(xTrain, yTrain, xTest, yTest, hp) {
    const lr = hp.learningRate ?? 0.01;
    const epochs = hp.epochs ?? 100;
    const nFeatures = xTrain[0].length;
    // Encode labels
    const classes = [...new Set(yTrain.map(String))].sort();
    const labelMap = new Map(classes.map((c, i) => [c, i]));
    const yEncoded = yTrain.map((y) => labelMap.get(String(y)) ?? 0);
    const yTestEncoded = yTest.map((y) => labelMap.get(String(y)) ?? 0);
    if (classes.length <= 2) {
        // Binary logistic regression
        const weights = new Float64Array(nFeatures);
        let bias = 0;
        const m = xTrain.length;
        for (let epoch = 0; epoch < epochs; epoch++) {
            const gradW = new Float64Array(nFeatures);
            let gradB = 0;
            for (let i = 0; i < m; i++) {
                let z = bias;
                for (let j = 0; j < nFeatures; j++)
                    z += weights[j] * xTrain[i][j];
                const pred = sigmoid(z);
                const error = pred - yEncoded[i];
                gradB += error;
                for (let j = 0; j < nFeatures; j++)
                    gradW[j] += error * xTrain[i][j];
            }
            bias -= (lr * gradB) / m;
            for (let j = 0; j < nFeatures; j++)
                weights[j] -= (lr * gradW[j]) / m;
        }
        const predict = (input) => input.map((row) => {
            let z = bias;
            for (let j = 0; j < nFeatures; j++)
                z += weights[j] * row[j];
            const p = sigmoid(z);
            return classes[p >= 0.5 ? 1 : 0] ?? classes[0];
        });
        const preds = predict(xTest);
        const predsEncoded = preds.map((p) => labelMap.get(String(p)) ?? 0);
        const metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
        return { metrics, predict };
    }
    // Multi-class: one-vs-rest
    const allWeights = [];
    const allBiases = [];
    for (let c = 0; c < classes.length; c++) {
        const weights = new Float64Array(nFeatures);
        let bias = 0;
        const yBinary = yEncoded.map((y) => (y === c ? 1 : 0));
        const m = xTrain.length;
        for (let epoch = 0; epoch < epochs; epoch++) {
            const gradW = new Float64Array(nFeatures);
            let gradB = 0;
            for (let i = 0; i < m; i++) {
                let z = bias;
                for (let j = 0; j < nFeatures; j++)
                    z += weights[j] * xTrain[i][j];
                const pred = sigmoid(z);
                const error = pred - yBinary[i];
                gradB += error;
                for (let j = 0; j < nFeatures; j++)
                    gradW[j] += error * xTrain[i][j];
            }
            bias -= (lr * gradB) / m;
            for (let j = 0; j < nFeatures; j++)
                weights[j] -= (lr * gradW[j]) / m;
        }
        allWeights.push(weights);
        allBiases.push(bias);
    }
    const predict = (input) => input.map((row) => {
        let bestClass = 0;
        let bestScore = -Infinity;
        for (let c = 0; c < classes.length; c++) {
            let z = allBiases[c];
            for (let j = 0; j < nFeatures; j++)
                z += allWeights[c][j] * row[j];
            if (z > bestScore) {
                bestScore = z;
                bestClass = c;
            }
        }
        return classes[bestClass];
    });
    const preds = predict(xTest);
    const predsEncoded = preds.map((p) => labelMap.get(String(p)) ?? 0);
    const metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
    return { metrics, predict };
}
function trainDecisionTree(xTrain, yTrain, xTest, yTest, hp, featureNames) {
    const maxDepth = hp.maxDepth ?? 10;
    const minSamplesSplit = hp.minSamplesSplit ?? 2;
    const isRegression = yTrain.every((y) => typeof y === 'number');
    const tree = buildTree(xTrain, yTrain, 0, maxDepth, minSamplesSplit, isRegression);
    const predict = (input) => input.map((row) => predictTree(tree, row));
    const predictions = predict(xTest);
    // Feature importance (simple: count splits per feature)
    const importanceMap = new Map();
    countSplits(tree, importanceMap);
    const totalSplits = [...importanceMap.values()].reduce((s, v) => s + v, 0) || 1;
    const featureImportance = [...importanceMap.entries()]
        .map(([idx, count]) => ({ feature: featureNames[idx] ?? `feature_${idx}`, importance: count / totalSplits }))
        .sort((a, b) => b.importance - a.importance);
    let metrics;
    if (isRegression) {
        metrics = computeRegressionMetrics(predictions, yTest);
    }
    else {
        const classes = [...new Set(yTrain.map(String))].sort();
        const labelMap = new Map(classes.map((c, i) => [c, i]));
        const predsEncoded = predictions.map((p) => labelMap.get(String(p)) ?? 0);
        const yTestEncoded = yTest.map((y) => labelMap.get(String(y)) ?? 0);
        metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
    }
    return { metrics, predict, featureImportance };
}
function buildTree(X, y, depth, maxDepth, minSamplesSplit, isRegression) {
    if (depth >= maxDepth || X.length < minSamplesSplit || allSame(y)) {
        return { value: isRegression ? mean(y) : mode(y) };
    }
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestImpurity = Infinity;
    let bestLeftIdx = [];
    let bestRightIdx = [];
    const nFeatures = X[0].length;
    for (let f = 0; f < nFeatures; f++) {
        const values = [...new Set(X.map((row) => row[f]))].sort((a, b) => a - b);
        for (let t = 0; t < values.length - 1; t++) {
            const threshold = (values[t] + values[t + 1]) / 2;
            const leftIdx = [];
            const rightIdx = [];
            for (let i = 0; i < X.length; i++) {
                if (X[i][f] <= threshold)
                    leftIdx.push(i);
                else
                    rightIdx.push(i);
            }
            if (leftIdx.length === 0 || rightIdx.length === 0)
                continue;
            const yLeft = leftIdx.map((i) => y[i]);
            const yRight = rightIdx.map((i) => y[i]);
            const impurity = isRegression
                ? (leftIdx.length * variance(yLeft) + rightIdx.length * variance(yRight)) / X.length
                : (leftIdx.length * giniImpurity(yLeft) + rightIdx.length * giniImpurity(yRight)) / X.length;
            if (impurity < bestImpurity) {
                bestImpurity = impurity;
                bestFeature = f;
                bestThreshold = threshold;
                bestLeftIdx = leftIdx;
                bestRightIdx = rightIdx;
            }
        }
    }
    if (bestFeature === -1) {
        return { value: isRegression ? mean(y) : mode(y) };
    }
    return {
        featureIdx: bestFeature,
        threshold: bestThreshold,
        impurity: bestImpurity,
        left: buildTree(bestLeftIdx.map((i) => X[i]), bestLeftIdx.map((i) => y[i]), depth + 1, maxDepth, minSamplesSplit, isRegression),
        right: buildTree(bestRightIdx.map((i) => X[i]), bestRightIdx.map((i) => y[i]), depth + 1, maxDepth, minSamplesSplit, isRegression),
    };
}
function predictTree(node, row) {
    if (node.value !== undefined)
        return node.value;
    if (row[node.featureIdx] <= node.threshold)
        return predictTree(node.left, row);
    return predictTree(node.right, row);
}
function countSplits(node, map) {
    if (node.featureIdx !== undefined) {
        map.set(node.featureIdx, (map.get(node.featureIdx) ?? 0) + 1);
        if (node.left)
            countSplits(node.left, map);
        if (node.right)
            countSplits(node.right, map);
    }
}
// ─── KNN ────────────────────────────────────────────────────
function trainKNN(xTrain, yTrain, xTest, yTest, hp) {
    const k = hp.k ?? 5;
    const isRegression = yTrain.every((y) => typeof y === 'number');
    const predict = (input) => input.map((row) => {
        const distances = xTrain.map((trainRow, i) => ({
            dist: euclideanDistance(row, trainRow),
            label: yTrain[i],
        }));
        distances.sort((a, b) => a.dist - b.dist);
        const neighbors = distances.slice(0, k);
        if (isRegression) {
            return mean(neighbors.map((n) => n.label));
        }
        return mode(neighbors.map((n) => n.label));
    });
    const predictions = predict(xTest);
    let metrics;
    if (isRegression) {
        metrics = computeRegressionMetrics(predictions, yTest);
    }
    else {
        const classes = [...new Set(yTrain.map(String))].sort();
        const labelMap = new Map(classes.map((c, i) => [c, i]));
        const predsEncoded = predictions.map((p) => labelMap.get(String(p)) ?? 0);
        const yTestEncoded = yTest.map((y) => labelMap.get(String(y)) ?? 0);
        metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
    }
    return { metrics, predict };
}
// ─── K-Means ────────────────────────────────────────────────
function trainKMeans(xTrain, xTest, hp) {
    const nClusters = hp.nClusters ?? 3;
    const maxIter = hp.maxIter ?? 300;
    const nFeatures = xTrain[0].length;
    // Initialize centroids (kmeans++)
    const centroids = [xTrain[Math.floor(Math.random() * xTrain.length)]];
    for (let c = 1; c < nClusters; c++) {
        const distances = xTrain.map((row) => {
            const minDist = Math.min(...centroids.map((cent) => euclideanDistance(row, cent)));
            return minDist * minDist;
        });
        const sum = distances.reduce((s, d) => s + d, 0);
        let r = Math.random() * sum;
        for (let i = 0; i < distances.length; i++) {
            r -= distances[i];
            if (r <= 0) {
                centroids.push([...xTrain[i]]);
                break;
            }
        }
        if (centroids.length === c)
            centroids.push([...xTrain[Math.floor(Math.random() * xTrain.length)]]);
    }
    // Iterate
    let assignments = new Int32Array(xTrain.length);
    for (let iter = 0; iter < maxIter; iter++) {
        // Assign
        const newAssignments = new Int32Array(xTrain.length);
        for (let i = 0; i < xTrain.length; i++) {
            let bestCluster = 0;
            let bestDist = Infinity;
            for (let c = 0; c < nClusters; c++) {
                const d = euclideanDistance(xTrain[i], centroids[c]);
                if (d < bestDist) {
                    bestDist = d;
                    bestCluster = c;
                }
            }
            newAssignments[i] = bestCluster;
        }
        // Check convergence
        let changed = false;
        for (let i = 0; i < xTrain.length; i++) {
            if (newAssignments[i] !== assignments[i]) {
                changed = true;
                break;
            }
        }
        assignments = newAssignments;
        if (!changed)
            break;
        // Update centroids
        for (let c = 0; c < nClusters; c++) {
            const members = xTrain.filter((_, i) => assignments[i] === c);
            if (members.length === 0)
                continue;
            for (let f = 0; f < nFeatures; f++) {
                centroids[c][f] = members.reduce((s, row) => s + row[f], 0) / members.length;
            }
        }
    }
    // Silhouette score
    let silhouette = 0;
    for (let i = 0; i < xTrain.length; i++) {
        const cluster = assignments[i];
        const sameCluster = xTrain.filter((_, j) => assignments[j] === cluster && j !== i);
        const a = sameCluster.length > 0 ? sameCluster.reduce((s, row) => s + euclideanDistance(xTrain[i], row), 0) / sameCluster.length : 0;
        let minB = Infinity;
        for (let c = 0; c < nClusters; c++) {
            if (c === cluster)
                continue;
            const otherCluster = xTrain.filter((_, j) => assignments[j] === c);
            if (otherCluster.length === 0)
                continue;
            const b = otherCluster.reduce((s, row) => s + euclideanDistance(xTrain[i], row), 0) / otherCluster.length;
            if (b < minB)
                minB = b;
        }
        silhouette += (minB - a) / Math.max(a, minB);
    }
    silhouette /= xTrain.length;
    const predict = (input) => input.map((row) => {
        let bestCluster = 0;
        let bestDist = Infinity;
        for (let c = 0; c < nClusters; c++) {
            const d = euclideanDistance(row, centroids[c]);
            if (d < bestDist) {
                bestDist = d;
                bestCluster = c;
            }
        }
        return bestCluster;
    });
    const inertia = xTrain.reduce((s, row, i) => s + euclideanDistance(row, centroids[assignments[i]]) ** 2, 0);
    const metrics = {
        silhouetteScore: silhouette,
        inertia,
        nClusters,
    };
    return { metrics, predict };
}
// ─── Naive Bayes ────────────────────────────────────────────
function trainNaiveBayes(xTrain, yTrain, xTest, yTest, hp) {
    const alpha = hp.alpha ?? 1.0;
    const classes = [...new Set(yTrain.map(String))].sort();
    const nFeatures = xTrain[0].length;
    // Compute class priors and per-feature Gaussian params
    const classPriors = new Map();
    const classMeans = new Map();
    const classStds = new Map();
    for (const cls of classes) {
        const indices = yTrain.map((y, i) => (String(y) === cls ? i : -1)).filter((i) => i >= 0);
        classPriors.set(cls, indices.length / yTrain.length);
        const means = [];
        const stds = [];
        for (let f = 0; f < nFeatures; f++) {
            const vals = indices.map((i) => xTrain[i][f]);
            const m = vals.reduce((s, v) => s + v, 0) / vals.length;
            const s = Math.sqrt(vals.reduce((s2, v) => s2 + (v - m) ** 2, 0) / vals.length + alpha);
            means.push(m);
            stds.push(s);
        }
        classMeans.set(cls, means);
        classStds.set(cls, stds);
    }
    const predict = (input) => input.map((row) => {
        let bestClass = classes[0];
        let bestLogProb = -Infinity;
        for (const cls of classes) {
            let logProb = Math.log(classPriors.get(cls));
            const means = classMeans.get(cls);
            const stds = classStds.get(cls);
            for (let f = 0; f < nFeatures; f++) {
                // Gaussian log-likelihood
                const diff = row[f] - means[f];
                logProb += -0.5 * Math.log(2 * Math.PI * stds[f] ** 2) - (diff ** 2) / (2 * stds[f] ** 2);
            }
            if (logProb > bestLogProb) {
                bestLogProb = logProb;
                bestClass = cls;
            }
        }
        return bestClass;
    });
    const predictions = predict(xTest);
    const labelMap = new Map(classes.map((c, i) => [c, i]));
    const predsEncoded = predictions.map((p) => labelMap.get(String(p)) ?? 0);
    const yTestEncoded = yTest.map((y) => labelMap.get(String(y)) ?? 0);
    const metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
    return { metrics, predict };
}
// ─── Random Forest ──────────────────────────────────────────
function trainRandomForest(xTrain, yTrain, xTest, yTest, hp, featureNames) {
    const nEstimators = Math.min(hp.nEstimators ?? 20, 50); // Cap for perf
    const maxDepth = hp.maxDepth ?? 8;
    const isRegression = yTrain.every((y) => typeof y === 'number');
    const trees = [];
    const n = xTrain.length;
    for (let t = 0; t < nEstimators; t++) {
        // Bootstrap sample
        const indices = Array.from({ length: n }, () => Math.floor(Math.random() * n));
        const xSample = indices.map((i) => xTrain[i]);
        const ySample = indices.map((i) => yTrain[i]);
        const tree = buildTree(xSample, ySample, 0, maxDepth, 2, isRegression);
        trees.push(tree);
    }
    const predict = (input) => input.map((row) => {
        const preds = trees.map((tree) => predictTree(tree, row));
        if (isRegression) {
            return mean(preds);
        }
        return mode(preds);
    });
    const predictions = predict(xTest);
    let metrics;
    if (isRegression) {
        metrics = computeRegressionMetrics(predictions, yTest);
    }
    else {
        const classes = [...new Set(yTrain.map(String))].sort();
        const labelMap = new Map(classes.map((c, i) => [c, i]));
        const predsEncoded = predictions.map((p) => labelMap.get(String(p)) ?? 0);
        const yTestEncoded = yTest.map((y) => labelMap.get(String(y)) ?? 0);
        metrics = computeClassificationMetrics(predsEncoded, yTestEncoded, classes.length);
    }
    // Aggregate feature importance from all trees
    const importanceMap = new Map();
    for (const tree of trees)
        countSplits(tree, importanceMap);
    const totalSplits = [...importanceMap.values()].reduce((s, v) => s + v, 0) || 1;
    const featureImportance = [...importanceMap.entries()]
        .map(([idx, count]) => ({ feature: featureNames[idx] ?? `feature_${idx}`, importance: count / totalSplits }))
        .sort((a, b) => b.importance - a.importance);
    return { metrics, predict, featureImportance };
}
// ─── Gradient Boosting ──────────────────────────────────────
function trainGradientBoosting(xTrain, yTrain, xTest, yTest, hp, featureNames) {
    const nEstimators = Math.min(hp.nEstimators ?? 50, 100);
    const learningRate = hp.learningRate ?? 0.1;
    const maxDepth = hp.maxDepth ?? 4;
    // Detect classification vs regression
    const isClassification = yTrain.some((y) => typeof y === 'string' || typeof y === 'boolean');
    if (isClassification) {
        // Encode labels
        const classes = [...new Set(yTrain.map(String))].sort();
        const labelMap = new Map(classes.map((c, i) => [c, i]));
        const yTrainNum = yTrain.map((y) => labelMap.get(String(y)) ?? 0);
        const yTestNum = yTest.map((y) => labelMap.get(String(y)) ?? 0);
        // One-vs-rest: train one boosting ensemble per class
        const classEnsembles = [];
        for (let c = 0; c < classes.length; c++) {
            const yBinary = yTrainNum.map((y) => (y === c ? 1 : 0));
            const basePred = mean(yBinary);
            const trees = [];
            let residuals = yBinary.map((y) => y - basePred);
            for (let t = 0; t < nEstimators; t++) {
                const tree = buildTree(xTrain, residuals, 0, maxDepth, 2, true);
                trees.push(tree);
                residuals = residuals.map((_, i) => {
                    const pred = predictTree(tree, xTrain[i]);
                    return residuals[i] - learningRate * pred;
                });
            }
            classEnsembles.push({ basePred, trees });
        }
        const predict = (input) => input.map((row) => {
            // Score each class, pick highest
            let bestClass = 0;
            let bestScore = -Infinity;
            for (let c = 0; c < classes.length; c++) {
                let score = classEnsembles[c].basePred;
                for (const tree of classEnsembles[c].trees) {
                    score += learningRate * predictTree(tree, row);
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestClass = c;
                }
            }
            return classes[bestClass];
        });
        const predictions = predict(xTest);
        const predsEncoded = predictions.map((p) => labelMap.get(String(p)) ?? 0);
        const metrics = computeClassificationMetrics(predsEncoded, yTestNum, classes.length);
        const importanceMap = new Map();
        for (const ens of classEnsembles) {
            for (const tree of ens.trees)
                countSplits(tree, importanceMap);
        }
        const totalSplits = [...importanceMap.values()].reduce((s, v) => s + v, 0) || 1;
        const featureImportance = [...importanceMap.entries()]
            .map(([idx, count]) => ({ feature: featureNames[idx] ?? `feature_${idx}`, importance: count / totalSplits }))
            .sort((a, b) => b.importance - a.importance);
        return { metrics, predict, featureImportance };
    }
    // Regression path
    const yTrainNum = yTrain;
    const yTestNum = yTest;
    const basePrediction = mean(yTrainNum);
    const trees = [];
    let residuals = yTrainNum.map((y) => y - basePrediction);
    for (let t = 0; t < nEstimators; t++) {
        const tree = buildTree(xTrain, residuals, 0, maxDepth, 2, true);
        trees.push(tree);
        residuals = residuals.map((_, i) => {
            const pred = predictTree(tree, xTrain[i]);
            return residuals[i] - learningRate * pred;
        });
    }
    const predict = (input) => input.map((row) => {
        let pred = basePrediction;
        for (const tree of trees) {
            pred += learningRate * predictTree(tree, row);
        }
        return pred;
    });
    const predictions = predict(xTest);
    const metrics = computeRegressionMetrics(predictions, yTestNum);
    const importanceMap = new Map();
    for (const tree of trees)
        countSplits(tree, importanceMap);
    const totalSplits = [...importanceMap.values()].reduce((s, v) => s + v, 0) || 1;
    const featureImportance = [...importanceMap.entries()]
        .map(([idx, count]) => ({ feature: featureNames[idx] ?? `feature_${idx}`, importance: count / totalSplits }))
        .sort((a, b) => b.importance - a.importance);
    return { metrics, predict, featureImportance };
}
// ─── Metrics Computation ────────────────────────────────────
function computeRegressionMetrics(predictions, actual) {
    const n = predictions.length;
    let sumSqErr = 0, sumAbsErr = 0;
    const meanActual = actual.reduce((s, v) => s + v, 0) / n;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
        const err = predictions[i] - actual[i];
        sumSqErr += err * err;
        sumAbsErr += Math.abs(err);
        ssTot += (actual[i] - meanActual) ** 2;
    }
    return {
        mse: sumSqErr / n,
        rmse: Math.sqrt(sumSqErr / n),
        mae: sumAbsErr / n,
        r2: 1 - sumSqErr / (ssTot || 1),
    };
}
function computeClassificationMetrics(predictions, actual, nClasses) {
    const n = predictions.length;
    let correct = 0;
    const tp = new Array(nClasses).fill(0);
    const fp = new Array(nClasses).fill(0);
    const fn = new Array(nClasses).fill(0);
    for (let i = 0; i < n; i++) {
        if (predictions[i] === actual[i]) {
            correct++;
            tp[predictions[i]]++;
        }
        else {
            fp[predictions[i]]++;
            fn[actual[i]]++;
        }
    }
    const accuracy = correct / n;
    // Macro-averaged precision, recall, F1
    let precisionSum = 0, recallSum = 0, f1Sum = 0;
    for (let c = 0; c < nClasses; c++) {
        const p = tp[c] / (tp[c] + fp[c]) || 0;
        const r = tp[c] / (tp[c] + fn[c]) || 0;
        const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;
        precisionSum += p;
        recallSum += r;
        f1Sum += f1;
    }
    return {
        accuracy,
        precision: precisionSum / nClasses,
        recall: recallSum / nClasses,
        f1Score: f1Sum / nClasses,
    };
}
// ─── Math Helpers ───────────────────────────────────────────
function sigmoid(z) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}
function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++)
        sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}
function mean(nums) {
    return nums.reduce((s, v) => s + v, 0) / nums.length;
}
function variance(nums) {
    const m = mean(nums);
    return nums.reduce((s, v) => s + (v - m) ** 2, 0) / nums.length;
}
function mode(values) {
    const freq = new Map();
    for (const v of values) {
        const key = String(v);
        freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [key, count] of freq) {
        if (count > bestCount) {
            best = key;
            bestCount = count;
        }
    }
    // Return original type if possible
    const original = values.find((v) => String(v) === best);
    return original ?? best;
}
function giniImpurity(values) {
    const freq = new Map();
    for (const v of values) {
        const key = String(v);
        freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const n = values.length;
    let impurity = 1;
    for (const count of freq.values()) {
        impurity -= (count / n) ** 2;
    }
    return impurity;
}
function allSame(values) {
    if (values.length <= 1)
        return true;
    const first = String(values[0]);
    return values.every((v) => String(v) === first);
}
//# sourceMappingURL=trainers.js.map