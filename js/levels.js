const levels = [
    {
        id: 1,
        time: 180, // 3 minutes
        title: "Niveau 1 : Routage Direct",
        desc: "Configurez les 2 PC et le routeur central. Adressez les interfaces. Les PC doivent avoir la bonne passerelle. Pas de routes statiques nécessaires.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -20, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: 0, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 20, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    {
        id: 2,
        time: 240, // 4 minutes
        title: "Niveau 2 : Relais Intermédiaire",
        desc: "La distance nécessite 2 routeurs. Configurez les adresses et ajoutez UNE route statique sur chaque routeur pour joindre le réseau opposé.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -25, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -8, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: 8, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 25, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    {
        id: 3,
        time: 300,
        title: "Niveau 3 : Chaine de Commandement",
        desc: "3 Routeurs en série. N'oubliez pas que chaque routeur doit connaitre TOUS les réseaux distants.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -30, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -10, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: 0, z: 10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 10, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 30, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "Routeur_3", int2: "Eth0" },
            { n1: "Routeur_3", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    { id: 4, time: 300, title: "Niveau 4 : Subnetting", desc: "Même architecture que le N2, mais utilisez des masques /26 ou /30.", nodes: [ { id: "PC_Alpha", type: "pc", pos: {x: -25, z: 0}, config: { ip:"", mask:"", gw:"" } }, { id: "Routeur_1", type: "router", pos: {x: -8, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] }, { id: "Routeur_2", type: "router", pos: {x: 8, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] }, { id: "PC_Bravo", type: "pc", pos: {x: 25, z: 0}, config: { ip:"", mask:"", gw:"" } } ], links: [ { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" }, { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" }, { n1: "Routeur_2", int1: "Eth1", n2: "PC_Bravo", int2: null } ] },
    { id: 5, time: 360, title: "Niveau 5 : Triangulation", desc: "Topologie en triangle. Le routage doit être parfait.", nodes: [ { id: "PC_Alpha", type: "pc", pos: {x: -25, z: -10}, config: { ip:"", mask:"", gw:"" } }, { id: "Routeur_1", type: "router", pos: {x: -10, z: -10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] }, { id: "Routeur_2", type: "router", pos: {x: 0, z: 10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] }, { id: "Routeur_3", type: "router", pos: {x: 10, z: -10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] }, { id: "PC_Bravo", type: "pc", pos: {x: 25, z: -10}, config: { ip:"", mask:"", gw:"" } } ], links: [ { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" }, { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" }, { n1: "Routeur_2", int1: "Eth1", n2: "Routeur_3", int2: "Eth0" }, { n1: "Routeur_3", int1: "Eth1", n2: "PC_Bravo", int2: null } ] },
    {
        id: 6, time: 360,
        title: "Niveau 6 : Carré",
        desc: "4 routeurs en carré. ALPHA est à gauche, BRAVO à droite. Deux chemins possibles (haut ou bas).",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -30, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -10, z: -12}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: -10, z: 12}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 10, z: -12}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 30, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth2", n2: "Routeur_3", int2: "Eth0" },
            { n1: "Routeur_3", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    {
        id: 7, time: 360,
        title: "Niveau 7 : Étoile",
        desc: "Topologie en étoile. Un routeur central connecte 3 branches. Le routage doit traverser le hub.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -25, z: -15}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -10, z: -15}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: 0, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 10, z: 15}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 25, z: 15}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "Routeur_3", int2: "Eth0" },
            { n1: "Routeur_3", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    {
        id: 8, time: 420,
        title: "Niveau 8 : Réseau en T",
        desc: "3 routeurs en ligne avec une branche latérale. Le routeur central doit router dans 3 directions.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -30, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -12, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: 0, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 0, z: 18}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 30, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "PC_Bravo", int2: null },
            { n1: "Routeur_2", int1: "Eth2", n2: "Routeur_3", int2: "Eth0" }
        ]
    },
    {
        id: 9, time: 420,
        title: "Niveau 9 : Losange",
        desc: "3 routeurs en losange. RAVEN distribue vers deux chemins (SIERRA et TANGO) qui convergent vers un 4e routeur relié à BRAVO.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -30, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -12, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: 5, z: -12}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 5, z: 12}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 30, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth2", n2: "Routeur_3", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "PC_Bravo", int2: null }
        ]
    },
    {
        id: 10, time: 480,
        title: "Niveau 10 : Examen Final",
        desc: "Réseau maillé : 4 routeurs interconnectés. Prouvez votre maîtrise du routage IP.",
        nodes: [
            { id: "PC_Alpha", type: "pc", pos: {x: -35, z: 0}, config: { ip:"", mask:"", gw:"" } },
            { id: "Routeur_1", type: "router", pos: {x: -15, z: -10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "Routeur_2", type: "router", pos: {x: -15, z: 10}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}], routes: [] },
            { id: "Routeur_3", type: "router", pos: {x: 15, z: 0}, interfaces: [{name: "Eth0", ip:"", mask:""}, {name: "Eth1", ip:"", mask:""}, {name: "Eth2", ip:"", mask:""}], routes: [] },
            { id: "PC_Bravo", type: "pc", pos: {x: 35, z: 0}, config: { ip:"", mask:"", gw:"" } }
        ],
        links: [
            { n1: "PC_Alpha", int1: null, n2: "Routeur_1", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth1", n2: "Routeur_3", int2: "Eth0" },
            { n1: "Routeur_1", int1: "Eth2", n2: "Routeur_2", int2: "Eth0" },
            { n1: "Routeur_2", int1: "Eth1", n2: "Routeur_3", int2: "Eth1" },
            { n1: "Routeur_3", int1: "Eth2", n2: "PC_Bravo", int2: null }
        ]
    }
];