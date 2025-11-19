-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: banking_system
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `date_of_birth` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (5,'Abhilash','E','edigaabhilash2@gmail.com','$2b$10$ahXvmvFUdaIPVekLs70RbuK0UObSEU33JOpw3yFU8UEtu1kD0CMem','2004-08-08','2025-09-12 05:46:10',1,1),(6,'ash','pika','eabhilash00@gmail.com','$2b$10$4UYGnGyHBXxvpSh4P68louZKx5RWD9j6mrj6NLdsRDKuWZGZQ97KW','2025-09-12','2025-09-12 06:05:21',1,0),(7,'madan','bb','madanbb2004@gmail.com','$2b$10$uOHDeOY2hDLBUD2Il22REORgIgY6b63kFPf8Lhnf3rRxTv.WFvAAW','2025-09-12','2025-09-12 08:37:58',0,0),(8,'chandu','mg','chandu@gmail.com','$2b$10$H2P5a/5cm/OwkWatnEk/4eXrZEomQ69/lNlzMfHqFRCP2vdsqTlOi','2025-09-15','2025-09-15 04:29:18',0,0),(9,'charan','g','charan@gmail.com','$2b$10$q/S2zzi/kgJv7p6Z3aT4rupi7XDRPmhUjGpLYIDysJdVN3GoqE1bq','2003-06-18','2025-09-15 15:17:28',0,0),(10,'Abhilash','E','edigaabhilash@gmail.com','$2b$10$gtogQ9gFwgi4kUXaqDYTxOKiOWnqqSabr3SDQV8h8YMyuCoIto.QS','2001-02-02','2025-09-16 14:56:30',0,0),(11,'naveen','kumar','byte7318@gmail.com','$2b$10$BWcDEYysnWajxaXjQpEdeuou8ADUevPPQ0fjMQ2rM9T/5Vv7vaKJu','2000-02-02','2025-09-16 15:05:01',1,0),(12,'gagan','d','gd202048@gmail.com','$2b$10$AMSQzka6YJifttyBslstbuWlorbys6MAk5ykc64PfmhaE3YSuHCW.','2001-02-02','2025-09-17 15:32:28',1,0),(13,'deekshith','gowda','deekshithgowda8888@gmail.com','$2b$10$PUmuaZ1eqRfb9OcNS9mDKOuieGUcCEWWqSkrRXXppyZz8u9lC.Lgi','2004-02-03','2025-11-03 05:50:09',0,0),(14,'chandan','mg','chandanmgclg@gmail.com','$2b$10$.NmrUlZ0qGF4kn2ReHP7Re4WRpsVd09hM14Mi0yUNzF1Jk.I0Ri8i','2006-01-03','2025-11-03 05:53:58',0,0),(15,'chandan','M G','cc641084@gmail.com','$2b$10$fqSqCeVDmS9zjQj.ZzIB7OSX0.9rmymBJGIgOaAc9jIgAG3r36632','1997-05-03','2025-11-03 06:01:17',1,0),(16,'charan','teja','skavyacharan@gmail.com','$2b$10$aDDCpbm8uPupho7/fZMns.2kpbSn6l/qBtV5K1SwWavh.1kwXUHeS','2005-02-03','2025-11-03 06:15:10',1,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-03 12:16:33
