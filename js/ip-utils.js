// ==========================================
// GAME EDR - UTILITAIRES IP PARTAGÉS
// ==========================================

const IPUtils = (() => {

    function ipToNumber(ipStr) {
        const parts = ipStr.split('.').map(Number);
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    function numberToIP(num) {
        return [
            (num >>> 24) & 0xFF,
            (num >>> 16) & 0xFF,
            (num >>> 8) & 0xFF,
            num & 0xFF
        ].join('.');
    }

    function cidrToMask(cidr) {
        if (cidr === 0) return 0;
        return (0xFFFFFFFF << (32 - cidr)) >>> 0;
    }

    function cidrToMaskString(cidr) {
        return numberToIP(cidrToMask(cidr));
    }

    function cidrForHosts(h) {
        let bits = 0;
        let size = 1;
        while (size - 2 < h) { bits++; size *= 2; }
        return 32 - bits;
    }

    function networkAddress(ip, cidr) {
        const ipNum = ipToNumber(ip);
        const mask = cidrToMask(cidr);
        return numberToIP((ipNum & mask) >>> 0);
    }

    function broadcastAddress(ip, cidr) {
        const ipNum = ipToNumber(ip);
        const mask = cidrToMask(cidr);
        const net = (ipNum & mask) >>> 0;
        return numberToIP((net | (~mask >>> 0)) >>> 0);
    }

    function firstUsableIP(ip, cidr) {
        const net = ipToNumber(networkAddress(ip, cidr));
        return numberToIP((net + 1) >>> 0);
    }

    function lastUsableIP(ip, cidr) {
        const bcast = ipToNumber(broadcastAddress(ip, cidr));
        return numberToIP((bcast - 1) >>> 0);
    }

    function hostCount(cidr) {
        if (cidr >= 31) return 0;
        return (1 << (32 - cidr)) - 2;
    }

    function isValidIP(str) {
        if (!str || typeof str !== 'string') return false;
        const parts = str.trim().split('.');
        if (parts.length !== 4) return false;
        return parts.every(p => {
            const n = parseInt(p, 10);
            return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p.trim();
        });
    }

    function isNetworkAddress(ip, cidr) {
        return networkAddress(ip, cidr) === ip;
    }

    return {
        ipToNumber, numberToIP, cidrToMask, cidrToMaskString,
        cidrForHosts, networkAddress, broadcastAddress,
        firstUsableIP, lastUsableIP, hostCount, isValidIP,
        isNetworkAddress
    };
})();
