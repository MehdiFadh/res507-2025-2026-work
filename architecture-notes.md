# Architecture, virtualisation et design de production — Notes

Lab RES507 — 85 Architecture, Virtualization, and Production Design.

---

## 1. Conteneurs vs machines virtuelles

### Tableau comparatif (au moins cinq différences)

| Critère | Conteneurs | Machines virtuelles (VM) |
|---------|------------|---------------------------|
| Partage du noyau | Partagent le noyau de l'hôte (Linux) | Chaque VM a son propre noyau (hyperviseur) |
| Démarrage | Très rapide (secondes) | Plus lent (plusieurs secondes à minutes) |
| Surcoût ressources | Faible (processus isolés) | Élevé (OS complet par VM) |
| Isolation sécurité | Namespaces, cgroups | Isolation matérielle (CPU, RAM, disque virtuels) |
| Complexité opérationnelle | Images légères, orchestration (Kubernetes) | Patching OS, gestion de multiples OS |

### Quand préférer une VM au conteneur ?

- Besoin d'isolation forte (multi-locataires hostiles, conformité).
- OS ou noyau différent de l'hôte (ex. Windows sur hôte Linux).
- Workloads legacy non conteneurisables.
- Exigences réglementaires imposant une VM par application ou par client.

### Quand combiner les deux ?

- Kubernetes sur VMs : nœuds du cluster = VMs pour isolation et gestion du parc.
- Base de données critique en VM (persistance, sauvegardes, SLA) et applications en conteneurs dans le cluster.
- Périmètre de sécurité : VMs pour la DMZ, conteneurs à l'intérieur du réseau interne.

---

## 2. Simulation de panne (suppression d'un pod)

### Qui a recréé le pod ?

Le **Deployment** (via le ReplicaSet) a recréé le pod. Kubernetes vise en permanence le nombre de réplicas déclaré dans le Deployment.

### Pourquoi ?

Le Deployment observe l'état du cluster et corrige les écarts : dès qu'un pod disparaît, le ReplicaSet crée un nouveau pod pour retrouver le nombre de réplicas souhaité (boucle de réconciliation).

### Que se passerait-il si le nœud lui-même tombait en panne ?

- Les pods du nœud passent en état Unknown puis Terminating.
- Le control plane détecte l'indisponibilité du nœud (conditions, heartbeats).
- Les Deployments/ReplicaSets recréent les pods sur les nœuds restants pour respecter le nombre de réplicas.
- Avec plusieurs réplicas et plusieurs nœuds, le service reste disponible ; avec un seul réplica ou un seul nœud, il y a interruption jusqu'au rescheduling.

---

## 3. Limites de ressources (requests / limits)

### Que sont les requests et les limits ?

- **Requests** : ressources réservées au moment du scheduling. Le scheduler ne place le pod que sur un nœud qui peut encore satisfaire ces requests (CPU/mémoire).
- **Limits** : plafond maximal d'utilisation. Au-delà, le conteneur peut être throttlé (CPU) ou tué (OOM pour la mémoire).

### Pourquoi c'est important en multi-tenant ?

- Prévisibilité : chaque équipe a une part réservée (requests) et ne peut pas dépasser (limits).
- Stabilité : un pod gourmand ne peut pas affamer les autres (évite le « noisy neighbour »).
- Planification : la somme des requests permet de dimensionner les nœuds et d'éviter la surcharge.

---

## 4. Sondes de readiness et liveness

### Différence entre readiness et liveness

- **Liveness** : « le processus est-il vivant ? ». Si la sonde échoue, Kubernetes redémarre le conteneur (restart).
- **Readiness** : « le pod est-il prêt à recevoir du trafic ? ». Si la sonde échoue, le pod est retiré des endpoints du Service ; il ne reçoit plus de requêtes jusqu'à ce que la sonde repasse au vert.

### Importance en production

- Readiness évite d'envoyer du trafic à un pod encore en démarrage (ex. connexion DB) ou temporairement surchargé.
- Liveness permet de redémarrer un processus bloqué ou mort sans intervention manuelle.
- Sans readiness : risque de 502/503 pendant les déploiements. Sans liveness : des pods « zombies » peuvent rester dans le Service.

---

## 5. Lien Kubernetes / virtualisation

### Qu'est-ce qui tourne sous le cluster k3s ?

Souvent des **machines physiques ou des VMs** (Linux). k3s est un runtime Kubernetes léger qui s'installe sur un ou plusieurs nœuds ; chaque nœud est typiquement une VM ou un serveur.

### Kubernetes remplace-t-il la virtualisation ?

Non. Kubernetes s'appuie sur des nœuds (souvent virtualisés). La virtualisation fournit l'isolation et la flexibilité au niveau infrastructure ; Kubernetes gère l'orchestration des conteneurs au-dessus.

### Chez un cloud provider, qu'est-ce qui héberge les nœuds ?

Les nœuds du cluster sont en général des **instances de calcul** (VMs) du cloud (EC2, GCE, machines virtuelles Azure, etc.), provisionnées et gérées par le provider ou par des outils (Terraform, CAPs).

### À quoi ressemble la stack dans différents contextes ?

- **Datacenter cloud** : VMs/instances pour les nœuds, stockage managé (EBS, etc.), réseau du provider ; Kubernetes (EKS, GKE, AKS) ou k3s sur ces VMs.
- **Système embarqué automobile** : nœuds sur matériel dédié (SoC, ECU), peu de nœuds, images minimales, contraintes temps réel et sécurité.
- **Institution financière** : VMs dans un DC privé ou hybride, réseau segmenté, bases en VM ou appliances, Kubernetes dans des zones contrôlées avec politiques strictes (réseau, secrets, conformité).

---

## 6. Architecture de production

### Objectifs du design

- **Plusieurs nœuds** : haute disponibilité et répartition de charge.
- **Persistance de la base de données** : volumes persistants (PVC/PV) ou base managée hors cluster.
- **Sauvegardes** : snapshots stockage, dump DB planifiés, stratégie de rétention et de restauration.
- **Monitoring** : métriques (Prometheus), tableaux de bord (Grafana), alertes.
- **Logging** : agrégation centralisée (EFK, Loki, ou solution cloud).
- **CI/CD** : pipeline (build, tests, déploiement) vers le cluster (Helm, Argo CD, GitOps).

### Répartition des rôles

- **Dans Kubernetes** : application quote-app (pods), Services, Ingress, secrets/configmaps, éventuellement opérateurs (DB, monitoring). Scaling et résilience gérés par K8s.
- **En VM (ou services managés)** : base PostgreSQL de production si on veut isolation, sauvegardes dédiées et périmètre de sécurité distinct ; serveurs de monitoring/logging si lourds ou partagés.
- **Hors cluster** : load balancer (cloud ou physique), DNS, annuaire, stockage objet (sauvegardes), pipeline CI/CD (GitHub Actions, Jenkins, etc.), gestion des identités (OIDC, LDAP).

---

## 7. Extension obligatoire : configuration par Secrets

### Refactor : identifiants en Secret

Les identifiants de la base de données ne doivent pas être en clair dans le manifeste du Deployment. Ils sont créés via un Secret Kubernetes et injectés dans les pods par `secretKeyRef`.

### Pourquoi c'est mieux que la configuration en clair ?

- Les manifests sont versionnés (Git) et souvent partagés : les mots de passe ne doivent pas y figurer.
- Les Secrets sont un objet dédié, avec des droits RBAC et des politiques d'accès distinctes.
- En production, on peut brancher un secret externe (Vault, provider cloud) sans modifier le manifeste.

### Un Secret est-il chiffré par défaut ? Où ?

- **Par défaut** : les données d'un Secret sont stockées en **base64** (encodage, pas chiffrement) dans etcd.
- Pour un vrai chiffrement au repos : activer l'option **Encryption at rest** d'etcd (Kubernetes) avec une clé de chiffrement.
- En cloud managé (EKS, GKE, AKS), l'encryption at rest pour etcd est souvent proposée ou activée par défaut.

---

## Synthèse

Ce document couvre l'analyse de l'architecture (conteneurs/VM, scaling, pannes, ressources, sondes), le lien Kubernetes/virtualisation, un design de production (multi-nœuds, persistance, sauvegardes, monitoring, logging, CI/CD) et l'usage des Secrets pour les identifiants. Les réponses sont à adapter à votre environnement (k3s, quote-app, PostgreSQL) et à votre contexte de déploiement.
