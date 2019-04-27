-- These 4 sessions are hard coded to have poorer response times
-- In our scenario, they are all from Lake Tahoe
badsessions = {}
badsessions["SD4776182741$SL9024850824FF9430705121ADFF5650737916"] = true
badsessions["SD8455772205$SL3881797404FF7655243977ADFF6057117618"] = true
badsessions["SD1427540556$SL1275597401FF5772426349ADFF8570818391"] = true
badsessions["SD2215060241$SL3658339903FF9509496472ADFF4058117289"] = true

-- HACK 
-- Gogen API doesn't let us just pick a random choice
-- So we need to know how big the session.csv file is
sessionCount = 787

-- We want an approximately gaussian distribution, so use central limit theorum to approximate
-- see example from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
function gaussianRand()
    local rand = 0
    for i = 0,5 do
        rand = rand + math.random()
    end

    return rand / 6
end

function gaussianRandom(lower, higher)
    return math.floor(lower + gaussianRand() * (higher - lower + 1))
end

l = getLine(0)
for i = 1,count do
    session = getFieldChoiceItem("sessionIdForGenerator", "sessionId", math.random(0, sessionCount-1))
    setToken("sessionId", session)
    timeTaken = gaussianRandom(50, 250)
    if badsessions[session] then
        timeTaken = timeTaken * gaussianRandom(5, 10)
    end
    setToken("timeTaken", timeTaken)
    se = replaceTokens(l)
    sendEvent(se)
end