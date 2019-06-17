hosts = getFieldChoice("host", "host")
mounts = getFieldChoice("disks", "mount")
disks = getFieldChoice("disks", "disk")
maxOps = tonumber(options["maxOps"])
avgKB = tonumber(options["avgKB"])
maxTime = tonumber(options["maxTime"])
for i, host in ipairs(hosts) do
    events = { }
    setToken("host", host)

    -- CPU Metrics
    totalCPU = math.random() + math.random(options["minCPU"], options["maxCPU"])
    pctUserAll = round(math.random() * totalCPU, 2)
    pctSystemAll = round(totalCPU - pctUserAll, 2)
    pctIowaitAll = round(math.random() * 0.1, 2)
    pctIdleAll = round(100 - pctUserAll - pctSystemAll, 2)

    setToken("pctUserAll", pctUserAll)
    setToken("pctSystemAll", pctSystemAll)
    setToken("pctIowaitAll", pctIowaitAll)
    setToken("pctIdleAll", pctIdleAll)
    l = getLine(0)
    l = replaceTokens(l)
    table.insert(events, l)

    for i=1,tonumber(options["numCPUs"]),1
    do
        oneCPU = round(math.random() * totalCPU, 2)
        pctUser = round(math.random() * oneCPU, 2)
        pctSystem = round(oneCPU - pctUser, 2)
        pctIowait = round(math.random() * 0.1, 2)
        pctIdle = round(100 - pctUser - pctSystem, 2)
        setToken("cpuNum", i)
        setToken("CPU", oneCPU)
        setToken("pctUser", pctUser)
        setToken("pctSystem", pctSystem)
        setToken("pctIowait", pctIowait)
        setToken("pctIdle", pctIdle)
        l = getLine(1) -- Must match line number in config
        l = replaceTokens(l)
        table.insert(events, l)
    end

    -- Bandwidth Metrics
    kbps = math.random(options["minKBPS"], options["maxKBPS"])
    avgPacketSize = math.random(options["minAvgPacketSize"], options["maxAvgPacketSize"])
    packets = round(kbps / avgPacketSize, 0)
    receivedPct = math.random(1000, 4000) / 10000
    for i=1,options["numNICs"] do
        nic = "eth"..tostring(i)
        rx_p = round(receivedPct * packets, 0)
        tx_p = round(packets - rx_p, 0)
        rx_kb = round(rx_p * avgPacketSize, 0)
        tx_kb = round(tx_p * avgPacketSize, 0)

        tokens = { "nic", "rx_p", "tx_p", "rx_kb", "tx_kb" }
        for i, t in ipairs(tokens) do
            setToken(t, _G[t])
        end
        l = getLine(2) -- Must match line number in config
        l = replaceTokens(l)
        table.insert(events, l)
    end

    -- Disk Metrics
    -- TODO maintain state, disk metrics shouldn't change much
    -- TODO This is kinda stupid data, not sure why I wrote it this way
    for i=1,#disks do
        -- Disk Usage
        usedPct = math.random() + math.random(options["minDiskUsedPct"], options["maxDiskUsedPct"])
        totalBytes = options["totalGBperDisk"]*1024*1024*1024
        usedBytes = round((usedPct/100) * totalBytes)
        availBytes = round(totalBytes - usedBytes)
        setToken("usedPct", round(usedPct, 2))
        setToken("usedBytes", usedBytes)
        setToken("availBytes", availBytes)
        setToken("totalBytes", totalBytes)
        if availBytes < (1*1024*1024*1024) then
            setToken("fs", "/dev/sdb1")
            setToken("mnt", "var")
        else
            setToken("fs", disks[i])
            setToken("mnt", mounts[i])
        end
        l = getLine(3) -- Must match line number in config
        l = replaceTokens(l)
        table.insert(events, l)

        -- IO Stats
        if options["highWrites"] > 0 and options["highReads"] > 0 then
            rrps = (math.random(0, 50) / 100) * maxOps
            wrps = maxOps - rrps
            qtime =(math.random(50, 100) / 100) * maxTime
        else if options["highWrites"] > 0 then
            rrps = (math.random(0, 10) / 100) * maxOps
            wrps = (math.random(0, 80) / 100) * maxOps
            qtime =(math.random(50, 80) / 100) * maxTime
        else if options["highReads"] > 0 then
            rrps = (math.random(0, 80) / 100) * maxOps
            wrps = (math.random(0, 10) / 100) * maxOps
            qtime =(math.random(50, 80) / 100) * maxTime
        else
            rrps = (math.random(0, 2) / 100) * maxOps
            wrps = (math.random(0, 2) / 100) * maxOps
            qtime = 0
        end end end
        device = disks[i]
        rkbps = round(rrps * (math.random(0, 20) / 100) * avgKB, 2)
        wkbps = round(wrps * (math.random(0, 20) / 100) * avgKB, 2)
        avgsvc = round((math.random(0, 1) / 100) * maxTime, 2)
        avgwait = round(avgsvc + qtime, 2)
        bwutil = round(((rrps + wrps) * avgsvc / 1000) * 100, 2)

        tokens = { "device", "rrps", "wrps", "rkbps", "wkbps", "avgwait", "avgsvc", "bwutil" }
        for i, t in ipairs(tokens) do
            setToken(t, _G[t])
        end
        l = getLine(4) -- Must match line number in config
        l = replaceTokens(l)
        table.insert(events, l)
    end

    -- VMStat
    memTotalMB = options["totalMB"]
    memUsedPct = round(math.random() + math.random(options["minMemUsedPct"], options["maxMemUsedPct"]),1)
    memFreePct = round(100-memUsedPct, 1)
    memFreeMB = memTotalMB * memFreePct / 100
    memUsedMB = memTotalMB - memFreeMB
    pgPageOut = math.random(1000000, 10000000)
    swapUsedPct = round(math.random(0, 200) / 100, 1)
    pgSwapOut = math.random(10000, 100000)
    cSwitches = math.random(1000000,5000000)
    interrupts = math.random(1000000,4000000)
    forks = math.random(10000,100000)
    processes = math.random(100,500)
    threads = math.random(1000,3000)
    loadAvg1mi = math.random(100,500) / 100
    waitThreads = 0
    interruptsPS = math.random(100000, 1000000) / 100
    pgPageInPS = math.random(1000, 15000) / 100
    pgPageOutPS = math.random(100000, 2000000) / 100

    tokens = { "memTotalMB", "memUsedPct", "memFreePct", "memFreeMB", "memUsedMB", "pgPageOut", "swapUsedPct", "pgSwapOut", "cSwitches", "interrupts", "forks", "processes", "threads", "loadAvg1mi", "waitThreads", "interruptsPS", "pgPageInPS", "pgPageOutPS"}
    for i, t in ipairs(tokens) do
        setToken(t, _G[t])
    end
    l = getLine(5) -- Must match line number in config
    l = replaceTokens(l)
    table.insert(events, l)
    send(events)
end
