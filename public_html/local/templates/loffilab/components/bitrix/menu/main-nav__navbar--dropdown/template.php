<?if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true) {
    die();
}?>

<?if (!empty($arResult)) :?>
<a class="dropdown-toggle btn btn-primary" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
                                        Каталог <span class="caret"></span>
									</a> 
<ul class="dropdown-menu">

<?
foreach ($arResult as $arItem) :
    if ($arParams["MAX_LEVEL"] == 1 && $arItem["DEPTH_LEVEL"] > 1) {
        continue;
    }
?>
    <?if ($arItem["SELECTED"]) :?>
        <li class="nav-item">
			<a href="<?=$arItem["LINK"]?>" class=" active">
				<?=$arItem["TEXT"]?>
			</a>
		</li>
    <?else :?>
        <li class="nav-item">
			<a href="<?=$arItem["LINK"]?>"  class="">
				<?=$arItem["TEXT"]?>
			</a>
		</li>
    <?endif?>
    
<?endforeach?>
 </ul>

<?endif?>