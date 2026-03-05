# Current System Problems

## 1. Base de données et application dans le même conteneur (Anti-pattern)
* **Quel est le problème ?**
L'API Quote et la base de données PostgreSQL s'exécutent au sein du même conteneur ou du même Pod.
* **Pourquoi est-ce important ?**
Dans Kubernetes, les conteneurs sont éphémères. Un Pod doit idéalement représenter un seul composant ou des composants fortement couplés dont l'un sert l'autre (principe de séparation des préoccupations). Mélanger une application sans état (stateless) avec une base de données avec état (stateful) empêche de faire évoluer, de mettre à jour ou de gérer l'état des deux de manière indépendante.
* **Quels risques de défaillance ou opérationnels cela pourrait-il engendrer ?**
Si l'application plante et que le Pod redémarre, la base de données redémarre également, entraînant une coupure de service totale. De plus, aucune persistance des données (PersistentVolumes) n'étant mentionnée, toutes les données (citations, paramètres) seront perdues à chaque redémarrage du conteneur. Enfin, impossible de faire évoluer (scaler) l'API seule (ajouter des réplicas) sans instancier de nouvelles bases de données indépendantes et désynchronisées.

## 2. Secrets stockés en clair dans des variables d'environnement
* **Quel est le problème ?**
Les données sensibles, comme les mots de passe de la base de données, sont définies en clair dans les variables d'environnement du déploiement.
* **Pourquoi est-ce important ?**
La sécurité est primordiale en production. Stocker des secrets en clair signifie que toute personne ayant un accès en lecture à la définition du déploiement, au système de contrôle de version (Git) ou à l'API Kubernetes peut lire ces informations sensibles.
* **Quels risques de défaillance ou opérationnels cela pourrait-il engendrer ?**
Le risque majeur est la fuite de données et la compromission du système. Un attaquant ou un employé malveillant pourrait récupérer ces secrets et s'introduire dans le système de base de données, exfiltrant, modifiant ou supprimant potentiellement toutes les données professionnelles. Les secrets doivent utiliser la ressource `Secret` de Kubernetes, ou mieux, un gestionnaire de secrets externe (ex: HashiCorp Vault ou AWS Secrets Manager).

## 3. Absence de sondes (Liveness/Readiness) et de limites de ressources (Requests/Limits)
* **Quel est le problème ?**
Le système ne configure ni sondes de vivacité ou de disponibilité, ni limites de ressources (CPU/RAM).
* **Pourquoi est-ce important ?**
Kubernetes utilise les sondes (probes) pour savoir si un Pod est prêt à recevoir du trafic (Readiness) ou s'il est bloqué et doit être redémarré (Liveness). Les limites de ressources garantissent qu'un Pod ne consomme pas indéfiniment les ressources du nœud hébergeur, ce qui pourrait impacter d'autres applications.
* **Quels risques de défaillance ou opérationnels cela pourrait-il engendrer ?**
Sans Readiness Probe, Kubernetes peut envoyer des utilisateurs vers un Pod qui est en train de démarrer (ce qui provoque des erreurs 502/503). Sans Liveness Probe, si l'application entre dans une boucle infinie ou un "deadlock", Kubernetes ne s'en rendra pas compte et ne la redémarrera pas, laissant le service indisponible. Sans limites de ressources, une fuite de mémoire dans le code peut consommer toute la RAM du nœud ("Noisy Neighbor"), entraînant le crash système (OOMKill) du nœud entier et de tout ce qui y tourne.

## 4. Dépendance à un seul Pod et remplacements immédiats (Downtime garanti)
* **Quel est le problème ?**
L'application ne s'exécute que sur un seul Pod (Single Point of Failure) et les déploiements remplacent immédiatement les pods au lieu d'effecter des mises à jour progressives (Rolling Update).
* **Pourquoi est-ce important ?**
La haute disponibilité et le "Zero Downtime Deployment" sont des standards en production. Avoir une seule instance signifie qu'il n'y a aucune tolérance aux pannes.
* **Quels risques de défaillance ou opérationnels cela pourrait-il engendrer ?**
À chaque mise à jour (évolution du code ou correction de bug), le Pod actuel est arrêté avant que le nouveau ne soit prêt, entraînant une interruption totale du service pour les utilisateurs. De même, si le nœud sous-jacent tombe en panne, l'application est complètement indisponible jusqu'à ce que le plan de contrôle (Control Plane) replanifie le Pod sur un nouveau nœud et qu'il démarre. Ce comportement est inacceptable en production.

# Production Architecture

# Operational Strategy

# Weakest Point
