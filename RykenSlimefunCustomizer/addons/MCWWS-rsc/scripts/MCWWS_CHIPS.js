function onUse(event) {

    var player = event.getPlayer();

    var inv = player.getInventory();

    var itemInMainHand = inv.getItemInMainHand();
    var itemInOffHand = inv.getItemInOffHand();

    var numMHI = itemInMainHand.getAmount();
    var numOHI = itemInOffHand.getAmount();

    var playerSaturation = player.getSaturation();
    var playerFoodLevel = player.getFoodLevel();

    runConsoleCommand("gamerule sendCommandFeedback false");

    if (playerFoodLevel < 20) {
        if (numMHI != 0) {
            var MHIname = itemInMainHand.getItemMeta().getDisplayName();
            var MHSaturation = itemInMainHand.getItemMeta().getFood().getSaturation();
            var MHFoodLevel = itemInMainHand.getItemMeta().getFood().getNutrition();

            if (MHIname == "§e🍟 薯条") {
                if (numOHI != 0) {
                    var OHIname = itemInOffHand.getItemMeta().getDisplayName();
                    var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
                    var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();

                    if (OHIname != "§e🍟 薯条") {
                        if (OHIname != "§x§F§8§3§1§2§F🥫 番茄酱") {
                            //独主
                            runOpCommand(player, "playsound minecraft:entity.generic.eat player %player_name% ~ ~ ~ 1 1 1");
                            void itemInMainHand.setAmount(numMHI - 1);
                            void player.setFoodLevel(MHFoodLevel + playerFoodLevel);
                            void player.setSaturation(MHSaturation + playerSaturation);
                        }
                    }
                    else {
                        //独主
                        runOpCommand(player, "playsound minecraft:entity.generic.eat player %player_name% ~ ~ ~ 1 1 1");
                        void itemInMainHand.setAmount(numMHI - 1);
                        void player.setFoodLevel(MHFoodLevel + playerFoodLevel);
                        void player.setSaturation(MHSaturation + playerSaturation);
                    }
                }
                else {
                    //独主
                    void itemInMainHand.setAmount(numMHI - 1);
                    void player.setFoodLevel(MHFoodLevel + playerFoodLevel);
                    void player.setSaturation(MHSaturation + playerSaturation);
                    runOpCommand(player, "playsound minecraft:entity.generic.eat player %player_name% ~ ~ ~ 1 1 1");

                }
            }
            else {
                var OHIname = itemInOffHand.getItemMeta().getDisplayName();
                var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
                var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
                //独副
                void itemInOffHand.setAmount(numOHI - 1);
                void player.setFoodLevel(OHFoodLevel + playerFoodLevel);
                void player.setSaturation(OHSaturation + playerSaturation);
                runOpCommand(player, "playsound minecraft:entity.generic.eat player %player_name% ~ ~ ~ 1 1 1");

            }
        }
        else {
            var OHIname = itemInOffHand.getItemMeta().getDisplayName();
            var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
            var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
            //独副
            void itemInOffHand.setAmount(numOHI - 1);
            void player.setFoodLevel(OHFoodLevel + playerFoodLevel);
            void player.setSaturation(OHSaturation + playerSaturation);
            runOpCommand(player, "playsound minecraft:entity.generic.eat player %player_name% ~ ~ ~ 1 1 1");

        }
        runConsoleCommand("gamerule sendCommandFeedback true");
    }
}